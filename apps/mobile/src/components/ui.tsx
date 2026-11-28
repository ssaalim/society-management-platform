import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
  TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { C, F } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export { Ionicons };
export type { IconName };

export function T({ style, weight = 'regular', ...p }: React.ComponentProps<typeof Text> & { weight?: 'regular' | 'medium' | 'semibold' }) {
  return <Text {...p} style={[{ fontFamily: F[weight], color: C.text, fontSize: 14 }, style]} />;
}

/** Faint skyline behind the header, as in the mockups. */
function Skyline() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
      {[
        [150, 40, 34, 100],
        [188, 20, 26, 120],
        [220, 55, 40, 85],
        [270, 10, 30, 130],
        [306, 45, 36, 95],
        [350, 25, 28, 115],
        [96, 70, 40, 70],
      ].map(([x, y, w, h], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} fill="#C9C3F2" opacity={0.1 + (i % 3) * 0.04} rx={2} />
      ))}
    </Svg>
  );
}

/** Page header: back arrow (or menu), title, optional search box, over the lavender skyline band. */
export function Header({
  title,
  back = true,
  right,
  children,
  big,
}: {
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
  children?: React.ReactNode;
  big?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 10 }, (children || big) ? s.headerRound : undefined]}>
      <Skyline />
      {title !== undefined && (
        <View style={s.headerRow}>
          {back && (
            <Pressable hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={24} color={C.text} />
            </Pressable>
          )}
          <T weight="medium" style={{ fontSize: 18, flex: 1 }} numberOfLines={1}>
            {title}
          </T>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function SearchBox(props: TextInputProps) {
  return (
    <View style={s.search}>
      <Ionicons name="search-outline" size={20} color={C.faint} />
      <TextInput placeholderTextColor={C.faint} style={[s.searchInput]} {...props} />
    </View>
  );
}

/** Scrollable page body with pull-to-refresh, loading and error states. */
export function Body({
  children,
  loading,
  error,
  onRefresh,
  style,
}: {
  children?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[{ padding: 16, paddingBottom: 24 + insets.bottom, gap: 12 }, style]}
      refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={C.orange} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {error ? <ErrorBox text={error} onRetry={onRefresh} /> : null}
      {loading && !error ? <ActivityIndicator color={C.orange} style={{ marginTop: 24 }} /> : null}
      {children}
    </ScrollView>
  );
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={[s.card, { backgroundColor: C.redSoft, borderColor: '#F8C9CB', gap: 8 }]}>
      <T style={{ color: C.red }}>{text}</T>
      {onRetry && (
        <Pressable onPress={onRetry}>
          <T weight="medium" style={{ color: C.red, textDecorationLine: 'underline' }}>
            Try again
          </T>
        </Pressable>
      )}
    </View>
  );
}

export function Empty({ icon = 'file-tray-outline', text }: { icon?: IconName; text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
      <Ionicons name={icon} size={36} color={C.faint} />
      <T style={{ color: C.sub, textAlign: 'center' }}>{text}</T>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
      <T weight="medium" style={{ fontSize: 16 }}>
        {children}
      </T>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <T style={{ color: C.sub, textDecorationLine: 'underline', fontSize: 13 }}>{action.label}</T>
        </Pressable>
      )}
    </View>
  );
}

/** Orange gradient (primary) or outlined (secondary) pill button. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  busy,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const h = small ? 36 : 50;
  const inner = (
    <View style={[s.btnInner, { height: h }]}>
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : C.orange} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 20} color={variant === 'primary' ? '#fff' : C.text} />}
          <T weight="medium" numberOfLines={1} style={{ color: variant === 'primary' ? '#fff' : C.text, fontSize: small ? 14 : 17 }}>
            {label}
          </T>
        </>
      )}
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ borderRadius: h / 2, overflow: 'hidden', opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={[C.orangeDeep, C.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={variant === 'outline' ? { borderWidth: 1, borderColor: C.orange, borderRadius: h / 2 } : undefined}>{inner}</View>
      )}
    </Pressable>
  );
}

const BADGE: Record<string, [string, string]> = {
  orange: ['#FCEFD5', '#B7791F'],
  green: [C.greenSoft, '#2F7D46'],
  red: [C.redSoft, C.red],
  purple: [C.purpleSoft, '#6D5BD0'],
  grey: ['#F1F1F4', C.sub],
};
export function Badge({ label, tone = 'orange', style }: { label: string; tone?: keyof typeof BADGE; style?: StyleProp<ViewStyle> }) {
  const [bg, fg] = BADGE[tone];
  return (
    <View style={[{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' }, style]}>
      <T style={{ color: fg, fontSize: 12 }}>{label}</T>
    </View>
  );
}

/** "Upcoming | Past" pill switch. */
export function Segmented<K extends string>({ value, options, onChange, tone = 'orange' }: { value: K; options: { key: K; label: string }[]; onChange: (k: K) => void; tone?: 'orange' | 'purple' }) {
  return (
    <View style={s.segment}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.segmentItem, on && { backgroundColor: tone === 'orange' ? C.orange : C.purple }]} accessibilityState={{ selected: on }}>
            <T style={{ color: on ? '#fff' : C.sub, fontSize: 14 }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontSize: 14 }}>{label}</T>
      {children}
      {hint ? <T style={{ fontSize: 12, color: C.sub }}>{hint}</T> : null}
    </View>
  );
}

export function Input({ style, ...p }: TextInputProps & { style?: StyleProp<TextStyle> }) {
  return <TextInput placeholderTextColor={C.faint} {...p} style={[s.input, p.multiline && { height: 110, textAlignVertical: 'top', paddingTop: 12 }, style]} />;
}

/** A row of choice chips (used instead of dropdowns: quicker on a phone). */
export function Chips<K extends string>({ value, options, onChange }: { value: K; options: { key: K; label: string }[]; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.chip, on && { backgroundColor: C.orange, borderColor: C.orange }]} accessibilityState={{ selected: on }}>
            <T style={{ color: on ? '#fff' : C.text, fontSize: 13 }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Round icon in a soft circle (list rows, tiles). */
export function IconBubble({ name, color = C.orangeDeep, bg = '#FFF', size = 48 }: { name: IconName; color?: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
      <T weight="medium" style={{ color: '#6D5BD0', fontSize: size * 0.36 }}>
        {initials || '?'}
      </T>
    </View>
  );
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8 }}>
      <T style={{ color: C.sub }}>{k}</T>
      {typeof v === 'string' ? (
        <T weight="medium" style={{ flexShrink: 1, textAlign: 'right' }}>
          {v}
        </T>
      ) : (
        v
      )}
    </View>
  );
}

export const s = StyleSheet.create({
  header: { backgroundColor: C.header, paddingHorizontal: 16, paddingBottom: 16, gap: 14, overflow: 'hidden' },
  headerRound: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 32 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 26,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: C.line,
  },
  searchInput: { flex: 1, fontFamily: F.regular, fontSize: 15, color: C.text, height: 46 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, backgroundColor: '#fff' },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  segment: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  segmentItem: { paddingHorizontal: 22, paddingVertical: 8, borderRadius: 20, minWidth: 110, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#E2E4EA', borderRadius: 12, paddingHorizontal: 14, height: 50, fontFamily: F.regular, fontSize: 15, color: C.text, backgroundColor: '#fff' },
  chip: { borderWidth: 1, borderColor: '#E2E4EA', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
});
