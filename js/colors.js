/* Color wheel: 12 wedges clockwise from top — matches reference diagram */
/* Hex array: [Outer (Đậm/Gốc), Middle (Vừa), Inner (Nhạt)] */
var WHEEL_COLORS = [
  { id: 'red', hex: ['#E32626', '#F07575', '#FAD6D6'], labelVi: 'Đỏ', tier: 'primary' },
  { id: 'red-orange', hex: ['#FF5E1F', '#FF9870', '#FFDAC7'], labelVi: 'Đỏ-cam', tier: 'tertiary' },
  { id: 'orange', hex: ['#FF8C00', '#FFBA66', '#FFE3C2'], labelVi: 'Cam', tier: 'secondary' },
  { id: 'yellow-orange', hex: ['#FFB347', '#FFD18A', '#FFF0D4'], labelVi: 'Vàng-cam', tier: 'tertiary' },
  { id: 'yellow', hex: ['#F5E400', '#F9EF66', '#FCF9BA'], labelVi: 'Vàng', tier: 'primary' },
  { id: 'yellow-green', hex: ['#9ACD32', '#C2DF81', '#E6F3C9'], labelVi: 'Vàng-lục', tier: 'tertiary' },
  { id: 'green', hex: ['#228B22', '#6BBE6B', '#BCE3BC'], labelVi: 'Lục', tier: 'secondary' },
  { id: 'blue-green', hex: ['#00A896', '#66CCC0', '#C2EBE6'], labelVi: 'Lam-lục', tier: 'tertiary' },
  { id: 'blue', hex: ['#1E4DFF', '#7A99FF', '#C7D6FF'], labelVi: 'Lam', tier: 'primary' },
  { id: 'blue-purple', hex: ['#6B5B95', '#A396C2', '#D8D1E8'], labelVi: 'Lam-tím', tier: 'tertiary' },
  { id: 'purple', hex: ['#6A0DAD', '#A666D1', '#DEBDEB'], labelVi: 'Tím', tier: 'secondary' },
  { id: 'red-purple', hex: ['#C71585', '#E06BBA', '#F3C2E3'], labelVi: 'Đỏ-tím', tier: 'tertiary' }
];

/* Level = which wheel indices must be filled (all correct to advance) */
var LEVELS = [
  { name: '1', titleVi: 'Màu cơ bản', subtitleVi: 'Primary', indices: [0, 4, 8] },
  { name: '2', titleVi: 'Màu thứ cấp', subtitleVi: 'Secondary', indices: [2, 6, 10] },
  { name: '3', titleVi: 'Màu bậc ba', subtitleVi: 'Tertiary', indices: [1, 3, 5, 7, 9, 11] }
];

var HARD_TIME_PER_LEVEL_SEC = 120; // Tăng thời gian vì số bi đã tăng gấp 3