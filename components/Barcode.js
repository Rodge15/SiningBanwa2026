// Dependency-free Code 128 (code set B) barcode, rendered as crisp SVG.
// No npm package and no browser APIs, so it renders on the server too and shows
// up identically for the customer and the admin. A real scanner app reads the
// exact value you pass in (e.g. the booking reference "SB-1A2B3C4D").

// The 107 Code 128 symbol patterns. Each string is the run-length of bar,
// space, bar, space... (first element is always a bar). Index = code value.
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;

// Returns the sequence of bar/space run-lengths for the whole symbol, or null if
// the value has a character Code 128 B cannot encode (outside ASCII 32..126).
function encode(value) {
  const text = String(value || "");
  const codes = [START_B];
  let checksum = START_B;

  for (let i = 0; i < text.length; i += 1) {
    const point = text.charCodeAt(i) - 32;
    if (point < 0 || point > 94) {
      return null;
    }
    codes.push(point);
    checksum += point * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(STOP);

  return codes.map((code) => PATTERNS[code]).join("");
}

export function Barcode({ value, height = 56, moduleWidth = 2, className = "" }) {
  const runs = encode(value);

  if (!runs) {
    return <span className={`font-mono text-sm ${className}`}>{value}</span>;
  }

  const bars = [];
  let x = 0;
  let isBar = true;

  for (const char of runs) {
    const width = Number(char) * moduleWidth;
    if (isBar) {
      bars.push(<rect key={x} x={x} y={0} width={width} height={height} fill="currentColor" />);
    }
    x += width;
    isBar = !isBar;
  }

  return (
    <svg
      role="img"
      aria-label={`Barcode ${value}`}
      viewBox={`0 0 ${x} ${height}`}
      width={x}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      className={`text-foreground ${className}`}
    >
      <rect x={0} y={0} width={x} height={height} fill="#ffffff" />
      {bars}
    </svg>
  );
}