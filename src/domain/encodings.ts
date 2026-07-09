import { CARD_COLUMNS, CARD_ROWS, EncodingProfile, HoleGrid, ROW_LABELS, createEmptyGrid } from "./types";

const GOST_TABLE: Record<number, string> = {
  0x00: "0",
  0x01: "1",
  0x02: "2",
  0x03: "3",
  0x04: "4",
  0x05: "5",
  0x06: "6",
  0x07: "7",
  0x08: "8",
  0x09: "9",
  0x0a: "+",
  0x0b: "-",
  0x0c: "/",
  0x0d: ",",
  0x0e: ".",
  0x0f: " ",
  0x10: "10",
  0x11: "↑",
  0x12: "(",
  0x13: ")",
  0x14: "×",
  0x15: "=",
  0x16: ";",
  0x17: "[",
  0x18: "]",
  0x19: "*",
  0x1a: "`",
  0x1b: "'",
  0x1c: "≠",
  0x1d: "<",
  0x1e: ">",
  0x1f: ":",
  0x20: "А",
  0x21: "Б",
  0x22: "В",
  0x23: "Г",
  0x24: "Д",
  0x25: "Е",
  0x26: "Ж",
  0x27: "З",
  0x28: "И",
  0x29: "Й",
  0x2a: "К",
  0x2b: "Л",
  0x2c: "М",
  0x2d: "Н",
  0x2e: "О",
  0x2f: "П",
  0x30: "Р",
  0x31: "С",
  0x32: "Т",
  0x33: "У",
  0x34: "Ф",
  0x35: "Х",
  0x36: "Ц",
  0x37: "Ч",
  0x38: "Ш",
  0x39: "Щ",
  0x3a: "Ы",
  0x3b: "Ь",
  0x3c: "Э",
  0x3d: "Ю",
  0x3e: "Я",
  0x3f: "D",
  0x40: "F",
  0x41: "G",
  0x42: "I",
  0x43: "J",
  0x44: "L",
  0x45: "N",
  0x46: "Q",
  0x47: "R",
  0x48: "S",
  0x49: "U",
  0x4a: "V",
  0x4b: "W",
  0x4c: "Z",
  0x56: "%",
  0x57: "◊",
  0x5a: "_",
  0x5b: "!",
  0x5d: "Ъ"
};

const IBM_BASE: Record<string, string> = {};

function key(rows: string[]): string {
  return rows.slice().sort(rowSort).join("-");
}

function rowSort(a: string, b: string): number {
  return ROW_LABELS.indexOf(a as never) - ROW_LABELS.indexOf(b as never);
}

function set(pattern: string[], char: string, target = IBM_BASE): void {
  target[key(pattern)] = char;
}

for (let digit = 0; digit <= 9; digit += 1) {
  set([String(digit)], String(digit));
}

"ABCDEFGHI".split("").forEach((char, index) => set(["12", String(index + 1)], char));
"JKLMNOPQR".split("").forEach((char, index) => set(["11", String(index + 1)], char));
"STUVWXYZ".split("").forEach((char, index) => set(["0", String(index + 2)], char));
set(["12"], "&");
set(["11"], "-");
set(["0", "1"], "/");
set(["8", "3"], "#");
set(["8", "4"], "@");
set(["11", "8", "3"], "$");
set(["11", "8", "4"], "*");
set(["12", "8", "3"], ".");
set(["0", "8", "3"], ",");
set(["0", "8", "4"], "%");

const IBM_026 = { ...IBM_BASE };
set(["12", "8", "4"], "(", IBM_026);
set(["11", "8", "4"], ")", IBM_026);
set(["8", "3"], "=", IBM_026);
set(["12", "8", "3"], "+", IBM_026);

const IBM_029 = { ...IBM_BASE };
set(["12", "8", "3"], "+", IBM_029);
set(["12", "8", "4"], "(", IBM_029);
set(["11", "8", "4"], ")", IBM_029);
set(["8", "3"], "=", IBM_029);

function rowMajorBits(grid: HoleGrid): number[] {
  const bits: number[] = [];
  for (let row = 0; row < CARD_ROWS; row += 1) {
    for (let column = 0; column < CARD_COLUMNS; column += 1) {
      bits.push(grid[row]?.[column] ? 1 : 0);
    }
  }
  return bits;
}

function decodeGost(grid: HoleGrid, width: 7 | 8): ReturnType<EncodingProfile["decode"]> {
  const bits = rowMajorBits(grid);
  const unknowns = [];
  const warnings = [];
  const chars: string[] = [];
  let parityErrors = 0;

  for (let index = 0; index + width <= bits.length; index += width) {
    const chunk = bits.slice(index, index + width);
    const ones = chunk.reduce((sum, bit) => sum + bit, 0);
    const code = width === 8 ? bitsToNumber(chunk.slice(1)) : bitsToNumber(chunk);
    const char = GOST_TABLE[code];

    if (width === 8 && ones % 2 === 0) {
      parityErrors += 1;
    }

    if (char === undefined) {
      unknowns.push({
        index: index / width,
        pattern: chunk.join(""),
        reason: `No GOST/UPP mapping for 0x${code.toString(16).padStart(2, "0")}`
      });
      chars.push("?");
    } else {
      chars.push(char);
    }
  }

  if (width === 8 && parityErrors > 0) {
    warnings.push(`${parityErrors} characters failed odd parity.`);
  }

  const meaningfulChars = chars.filter((char) => char !== " ").length;
  if (meaningfulChars === 0) {
    warnings.push("No non-space GOST/UPP characters were decoded.");
  }

  const penalty = unknowns.length + parityErrors * 0.5;
  const confidence = clamp01(1 - penalty / Math.max(1, chars.length));

  return {
    text: chars.join("").trimEnd(),
    confidence,
    unknowns,
    warnings
  };
}

function decodeIbm(grid: HoleGrid, table: Record<string, string>, label: string): ReturnType<EncodingProfile["decode"]> {
  const chars: string[] = [];
  const unknowns = [];
  const warnings = [];

  for (let column = 0; column < CARD_COLUMNS; column += 1) {
    const rows = ROW_LABELS.filter((_, rowIndex) => grid[rowIndex]?.[column]);
    const pattern = key([...rows]);

    if (rows.length === 0) {
      chars.push(" ");
    } else if (table[pattern]) {
      chars.push(table[pattern]);
    } else {
      unknowns.push({
        index: column,
        pattern: pattern || "blank",
        reason: `No ${label} mapping for rows ${pattern}`
      });
      chars.push("?");
    }
  }

  if (unknowns.length > 0) {
    warnings.push(`${unknowns.length} columns did not match the selected IBM table.`);
  }

  const confidence = clamp01(1 - unknowns.length / CARD_COLUMNS);

  return {
    text: chars.join("").trimEnd(),
    confidence,
    unknowns,
    warnings
  };
}

function bitsToNumber(bits: number[]): number {
  return bits.reduce((value, bit) => (value << 1) | bit, 0);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const ENCODING_PROFILES: EncodingProfile[] = [
  {
    id: "gost-upp-8bit-parity",
    label: "GOST/UPP 8-bit with odd parity",
    layout: "row-major",
    decode: (grid) => decodeGost(grid, 8)
  },
  {
    id: "gost-upp-7bit",
    label: "GOST/UPP 7-bit",
    layout: "row-major",
    decode: (grid) => decodeGost(grid, 7)
  },
  {
    id: "ibm-hollerith-026",
    label: "IBM Hollerith 026",
    layout: "column-major",
    decode: (grid) => decodeIbm(grid, IBM_026, "IBM 026")
  },
  {
    id: "ibm-hollerith-029",
    label: "IBM Hollerith 029",
    layout: "column-major",
    decode: (grid) => decodeIbm(grid, IBM_029, "IBM 029")
  }
];

export function getProfile(id: string): EncodingProfile {
  return ENCODING_PROFILES.find((profile) => profile.id === id) ?? ENCODING_PROFILES[0];
}

export function scoreProfiles(grid: HoleGrid): Array<{ profile: EncodingProfile; result: ReturnType<EncodingProfile["decode"]> }> {
  return ENCODING_PROFILES.map((profile) => ({ profile, result: profile.decode(grid) })).sort(
    (a, b) => b.result.confidence - a.result.confidence
  );
}

export function buildIbmTestGrid(text: string): HoleGrid {
  const reverse = new Map<string, string>();
  Object.entries(IBM_BASE).forEach(([pattern, char]) => reverse.set(char, pattern));
  const grid = createEmptyGrid();

  text
    .slice(0, CARD_COLUMNS)
    .split("")
    .forEach((char, column) => {
      const pattern = reverse.get(char);
      if (!pattern) {
        return;
      }
      pattern.split("-").forEach((row) => {
        const rowIndex = ROW_LABELS.indexOf(row as never);
        if (rowIndex >= 0) {
          grid[rowIndex][column] = true;
        }
      });
    });

  return grid;
}

export function buildGostTestGrid(codes: number[], width: 7 | 8): HoleGrid {
  const grid = createEmptyGrid();
  const totalChars = Math.floor((CARD_ROWS * CARD_COLUMNS) / width);
  const paddedCodes = [...codes, ...Array.from({ length: Math.max(0, totalChars - codes.length) }, () => 0x0f)];
  const bits = paddedCodes.flatMap((code) => {
    const payload = numberToBits(code, 7);
    if (width === 7) {
      return payload;
    }
    const payloadOnes = payload.reduce((sum, bit) => sum + bit, 0);
    const parity = payloadOnes % 2 === 0 ? 1 : 0;
    return [parity, ...payload];
  });

  bits.slice(0, CARD_ROWS * CARD_COLUMNS).forEach((bit, offset) => {
    const row = Math.floor(offset / CARD_COLUMNS);
    const column = offset % CARD_COLUMNS;
    grid[row][column] = bit === 1;
  });

  return grid;
}

function numberToBits(value: number, width: number): number[] {
  return Array.from({ length: width }, (_, index) => (value >> (width - index - 1)) & 1);
}
