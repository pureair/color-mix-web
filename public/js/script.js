// Color Mix Tool - JS version (converted from py_to_js.py)
// Supports RGB/HSV input, outputs CMYW, RYBW, CMYKW, RYBKW ratios

// --- Utility functions ---
function gcdAll(nums) {
	nums = nums.filter(n => n !== 0);
	if (nums.length === 0) return 1;
	let g = nums[0];
	for (let n of nums.slice(1)) {
		g = gcd(g, n);
	}
	return g;
}
function gcd(a, b) {
	if (!b) return a;
	return gcd(b, a % b);
}

function normalizeRatio(vals, scale = 8) {
	vals = vals.map(Number);
	const s = vals.reduce((a, b) => a + b, 0);
	if (s === 0) return vals.map(_ => 0);
	const props = vals.map(v => v / s);
	let ints = props.map(p => Math.max(0, Math.round(p * scale)));
	if (ints.every(x => x === 0)) {
		const i = props.indexOf(Math.max(...props));
		ints[i] = 1;
	}
	const g = gcdAll(ints);
	return ints.map(i => i / g).join(":");
}

function getIntegerRatio(paintMix) {
	// Only paints >= 1%
	const paints = {};
	for (const k in paintMix) {
		if (paintMix[k] >= 1.0) paints[k] = paintMix[k];
	}
	if (Object.keys(paints).length === 0) return "0:0:0:0:0";
	const total = Object.values(paints).reduce((a, b) => a + b, 0);
	if (total === 0) return "0:0:0:0:0";
	const target = 8;
	const scaled = {};
	for (const k in paints) {
		scaled[k] = (paints[k] / total) * target;
	}
	const rounded = {};
	for (const k in scaled) {
		rounded[k] = Math.round(scaled[k]);
	}
	if (Object.values(rounded).every(v => v === 0)) {
		const maxPaint = Object.keys(paints).reduce((a, b) => paints[a] > paints[b] ? a : b);
		rounded[maxPaint] = 1;
	}
	const values = Object.values(rounded).filter(v => v > 0);
	let finalParts = {...rounded};
	if (values.length > 1) {
		const divisor = values.reduce((a, b) => gcd(a, b));
		if (divisor > 0) {
			for (const k in finalParts) finalParts[k] = finalParts[k] / divisor;
		}
	}
	// Order: Cyan, Magenta, Yellow, Black, White or Red, Yellow, Blue, Black, White
	return Object.keys(paintMix).map(name => finalParts[name] || 0).join(":");
}

// --- Input detection ---
function parseInput(s) {
	s = s.trim();
	// Hex RGB direct forms (6 hex digits, with or without #)
	if (/^#?[0-9A-Fa-f]{6}$/.test(s) || s.toLowerCase().startsWith("0x")) {
		let hexval = s.replace(/^#|0x/i, "");
		let r = parseInt(hexval.slice(0, 2), 16);
		let g = parseInt(hexval.slice(2, 4), 16);
		let b = parseInt(hexval.slice(4, 6), 16);
		return ["rgb", [r, g, b]];
	}
	// If input is 6 digits and all are hex, treat as hex RGB
	if (/^[0-9A-Fa-f]{6}$/.test(s)) {
		let r = parseInt(s.slice(0, 2), 16);
		let g = parseInt(s.slice(2, 4), 16);
		let b = parseInt(s.slice(4, 6), 16);
		return ["rgb", [r, g, b]];
	}
	// Space or comma separated
	let parts = s.split(/[ ,]+/);
	if (parts.length === 3) {
		// HSV if any float
		if (parts.some(p => p.includes("."))) {
			let h = parseFloat(parts[0]);
			let s_ = parseFloat(parts[1]);
			let v = parseFloat(parts[2]);
			let [r, g, b] = hsvToRgb(h, s_, v);
			return ["rgb", [r, g, b]];
		}
		// If any A-F letter → hex
		if (parts.some(p => /[A-Fa-f]/.test(p))) {
			let [r, g, b] = parts.map(p => parseInt(p, 16));
			return ["rgb", [r, g, b]];
		}
		// Three-digit → integer
		if (parts.some(p => p.length === 3)) {
			let [r, g, b] = parts.map(Number);
			return ["rgb", [r, g, b]];
		}
		// All two-digit → hex
		if (parts.every(p => p.length === 2)) {
			let [r, g, b] = parts.map(p => parseInt(p, 16));
			return ["rgb", [r, g, b]];
		}
		// Default → hex
		let [r, g, b] = parts.map(p => parseInt(p, 16));
		return ["rgb", [r, g, b]];
	}
	throw new Error("Unrecognized input format");
}

// HSV to RGB (h in 0-360, s/v in 0-1)
function hsvToRgb(h, s, v) {
	h = h % 360;
	let c = v * s;
	let x = c * (1 - Math.abs((h / 60) % 2 - 1));
	let m = v - c;
	let r1, g1, b1;
	if (h < 60) [r1, g1, b1] = [c, x, 0];
	else if (h < 120) [r1, g1, b1] = [x, c, 0];
	else if (h < 180) [r1, g1, b1] = [0, c, x];
	else if (h < 240) [r1, g1, b1] = [0, x, c];
	else if (h < 300) [r1, g1, b1] = [x, 0, c];
	else [r1, g1, b1] = [c, 0, x];
	return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

// --- Conversions ---
function rgbToCmyw(r, g, b) {
	return [1 - r / 255, 1 - g / 255, 1 - b / 255, Math.min(r, g, b) / 255];
}

function rgbToCmykw(r, g, b) {
	if (![r, g, b].every(val => 0 <= val && val <= 255)) throw new Error("RGB values must be 0-255");
	let rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
	// Calculate Black (K) paint component
	let black = 1 - Math.max(rNorm, gNorm, bNorm);
	// Calculate White (W) paint component
	let white = Math.min(rNorm, gNorm, bNorm);
	// Calculate the total amount of "color"
	let colorPart = 1 - white - black;
	// Handle the pure gray case and black/white colors where color_part is 0
	if (colorPart === 0) {
		return {
			Cyan: 0,
			Magenta: 0,
			Yellow: 0,
			Black: +(black * 100).toFixed(2),
			White: +(white * 100).toFixed(2)
		};
	}
	// Core CMYK conversion
	let c = (1 - rNorm - black) / (1 - black);
	let m = (1 - gNorm - black) / (1 - black);
	let y = (1 - bNorm - black) / (1 - black);
	// Normalize CMY so they sum to the color_part
//	let totalCmy = c + m + y;
//	if (totalCmy === 0) {
//		return {
//			Cyan: 0,
//			Magenta: 0,
//			Yellow: 0,
//			Black: +(black * 100).toFixed(2),
//			White: +(white * 100).toFixed(2)
//		};
//	}
//	let cRatio = c / totalCmy;
//	let mRatio = m / totalCmy;
//	let yRatio = y / totalCmy;
	// Calculate final paint amounts by distributing the color part
//	let cyan = cRatio * colorPart;
//	let magenta = mRatio * colorPart;
//	let yellow = yRatio * colorPart;
	// Return as percentages, rounded to 2 decimal places
	return {
		Cyan: +(c * 100).toFixed(2),
		Magenta: +(m * 100).toFixed(2),
		Yellow: +(y * 100).toFixed(2),
		Black: +(black * 100).toFixed(2),
		White: +(white * 100).toFixed(2)
	};
}


// Custom helper function to convert pure RGB chroma to RYB chroma (no normalization)
function _rgbToRybCustom(r, g, b) {
	let w = Math.min(r, g, b);
	r = r - w;
	g = g - w;
	b = b - w;
	let y = Math.min(r, g);
	r = r - y;
	g = g - y;
	// Green is a mix of yellow and blue in RYB, so split the green component
	b = b + g;
	y = y + g;
	// No normalization here
	return [r, y, b];
}


function rgbToRybkw(r, g, b) {
	if (![r, g, b].every(val => 0 <= val && val <= 255)) throw new Error("RGB values must be 0-255");
	let rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
	// Calculate White and Black paint components
	let white = Math.min(rNorm, gNorm, bNorm);
	let black = 1 - Math.max(rNorm, gNorm, bNorm);
	// Calculate the total amount of "color"
	let colorPart = 1 - white - black;
	if (colorPart === 0) {
		return {
			Red: 0,
			Yellow: 0,
			Blue: 0,
			Black: +(black * 100).toFixed(2),
			White: +(white * 100).toFixed(2)
		};
	}
	// Isolate the pure chroma by removing gray components
	let rChroma = (rNorm - white) / colorPart;
	let gChroma = (gNorm - white) / colorPart;
	let bChroma = (bNorm - white) / colorPart;
	// Convert pure RGB chroma to RYB chroma (custom, no normalization)
	let [rRyb, yRyb, bRyb] = _rgbToRybCustom(rChroma, gChroma, bChroma);
	// For a color where a component is 1.0, the "color part" is absorbed by that component.
	// We can assume a new total for the RYB values that represents their "volume".
	let red = rRyb * colorPart;
	let yellow = yRyb * colorPart;
	let blue = bRyb * colorPart;
	// Return as percentages, rounded to 2 decimal places
	return {
		Red: +(red * 100).toFixed(2),
		Yellow: +(yellow * 100).toFixed(2),
		Blue: +(blue * 100).toFixed(2),
		Black: +(black * 100).toFixed(2),
		White: +(white * 100).toFixed(2)
	};
}


function hueToNcol(hue) {
  while (hue >= 360) {
    hue = hue - 360;
  }
  if (hue < 60) {return "R" + (hue / 0.6); }
  if (hue < 120) {return "Y" + ((hue - 60) / 0.6); }
  if (hue < 180) {return "G" + ((hue - 120) / 0.6); }
  if (hue < 240) {return "C" + ((hue - 180) / 0.6); }
  if (hue < 300) {return "B" + ((hue - 240) / 0.6); }
  if (hue < 360) {return "M" + ((hue - 300) / 0.6); }
}


// --- Exported for UI integration ---
window.colorMix = {
	parseInput,
	rgbToCmyw,
	rgbToCmykw,
	rgbToRybkw,
	normalizeRatio,
	getIntegerRatio,
	hueToNcol
};
