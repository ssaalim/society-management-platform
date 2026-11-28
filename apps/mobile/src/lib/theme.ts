/** Colours and type from the resident app mockups: warm orange actions on white, a soft lavender header. */
export const C = {
  orange: '#F2A93B',
  orangeDeep: '#EF8532',
  orangeSoft: '#FDF3E3',
  orangeLine: '#F6D9A8',
  text: '#1E2330',
  sub: '#6B7280',
  faint: '#9CA3AF',
  line: '#ECECF2',
  bg: '#FFFFFF',
  header: '#F4F2FD',
  card: '#FBFAFF',
  purple: '#9B8AF2',
  purpleSoft: '#EEEAFD',
  green: '#3BA55C',
  greenSoft: '#E8F5EC',
  red: '#E5484D',
  redSoft: '#FDECEC',
  blueSoft: '#EDF1FD',
};

export const F = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
};

/** Pastel backgrounds for the home tiles, in mockup order. */
export const TILE_BG = ['#FDF3EC', '#EAF4EC', '#EEF0FD', '#F3EDFB', '#FDF5E7', '#FDF0F0', '#EAF6F6', '#F5F0E8'];

export const rupees = (v: number | string | null | undefined) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const timeOf = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';

export const monthOf = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';

export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
