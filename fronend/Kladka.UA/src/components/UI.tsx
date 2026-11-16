import React, { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextProps, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, fonts, categoryTitle } from '../theme';
import type { Listing } from '../domain/types';
import { imageSource } from '../lib/media';
import { priceLabel, shortDate } from '../domain/logic';
import { useStore } from '../state/AppStore';

export type IconName = React.ComponentProps<typeof Feather>['name'];
export function Icon({ name, size = 20, color = C.text }: { name: IconName; size?: number; color?: string }) { return <Feather name={name} size={size} color={color} />; }
export function T({ weight = 'regular', style, ...props }: TextProps & { weight?: keyof typeof fonts }) { return <Text {...props} style={[{ color: C.text, fontFamily: fonts[weight], fontSize: 14, lineHeight: 21 }, style]} />; }
export function Button({ title, onPress, icon, variant = 'primary', busy = false, disabled = false, style, testID }: {
  title: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'secondary' | 'danger'; busy?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const primary = variant === 'primary';
  const color = primary ? C.dark : variant === 'danger' ? C.danger : C.text;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} disabled={busy || disabled} onPress={onPress} style={({ pressed }) => [s.button, { backgroundColor: primary ? C.lime : C.raised, opacity: busy || disabled ? 0.45 : pressed ? 0.75 : 1 }, style]}>
    {busy ? <ActivityIndicator color={color} /> : icon ? <Icon name={icon} color={color} size={18} /> : null}
    <T weight="bold" style={{ color, fontSize: 14 }}>{title}</T>
  </Pressable>;
}
export function RoundButton({ icon, onPress, label, active = false }: { icon: IconName; onPress: () => void; label: string; active?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [s.round, { backgroundColor: active ? C.lime : C.raised, opacity: pressed ? 0.7 : 1 }]}><Icon name={icon} color={active ? C.dark : C.text} size={19} /></Pressable>;
}
export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return <View style={{ gap: 8, marginBottom: 18 }}>{label ? <T weight="bold" style={{ color: C.muted, fontSize: 12 }}>{label}</T> : null}<TextInput placeholderTextColor="#777F6E" selectionColor={C.lime} {...props} style={[s.input, props.multiline && { height: 140, paddingTop: 15, textAlignVertical: 'top' }, style]} /></View>;
}
export function Chip({ title, active, onPress, icon }: { title: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityState={{ selected: Boolean(active) }} onPress={onPress} style={[s.chip, active && { backgroundColor: C.lime, borderColor: C.lime }]}>
    {icon ? <Icon name={icon} size={14} color={active ? C.dark : C.muted} /> : null}
    <T weight="medium" style={{ fontSize: 12, color: active ? C.dark : C.muted }}>{title}</T>
  </Pressable>;
}
export function Pill({ children, lime = false }: { children: ReactNode; lime?: boolean }) { return <View style={[s.pill, lime && { backgroundColor: C.lime }]}><T weight="bold" style={{ fontSize: 10, lineHeight: 16, color: lime ? C.dark : C.text }}>{children}</T></View>; }
export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[s.row, style]}>{children}</View>; }
export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return <Row style={{ paddingHorizontal: 22, minHeight: 66, gap: 14 }}>
    {onBack ? <RoundButton icon="arrow-left" label="Назад" onPress={onBack} /> : null}
    <T weight="bold" style={{ fontSize: 20, flex: 1 }}>{title}</T>{right}
  </Row>;
}
export function Page({ children, bottom = false }: { children: ReactNode; bottom?: boolean }) { return <SafeAreaView edges={bottom ? ['top', 'bottom'] : ['top']} style={{ flex: 1, backgroundColor: C.bg }}>{children}</SafeAreaView>; }
export function Empty({ title, body, icon = 'search', action }: { title: string; body: string; icon?: IconName; action?: ReactNode }) {
  return <View style={s.empty}><View style={s.emptyIcon}><Icon name={icon} color={C.lime} size={27} /></View><T weight="bold" style={{ fontSize: 20, textAlign: 'center' }}>{title}</T><T style={{ textAlign: 'center', color: C.muted, maxWidth: 310 }}>{body}</T>{action}</View>;
}
export function Notice({ children, lime = false }: { children: ReactNode; lime?: boolean }) { return <View style={[s.notice, lime && { borderColor: '#4B5F26', backgroundColor: '#222B15' }]}><Icon name="info" color={lime ? C.lime : C.muted} size={16} /><T style={{ flex: 1, color: lime ? C.lime : C.muted, fontSize: 12, lineHeight: 18 }}>{children}</T></View>; }
export function Divider() { return <View style={{ height: 1, backgroundColor: C.line, marginVertical: 18 }} />; }
export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) { return <View style={{ gap: 5, marginBottom: 18 }}><T weight="display" style={{ fontSize: 24, lineHeight: 32 }}>{title}</T>{subtitle ? <T style={{ color: C.muted }}>{subtitle}</T> : null}</View>; }

export function ListingCard({ listing, onPress, compact = false }: { listing: Listing; onPress: () => void; compact?: boolean }) {
  const store = useStore();
  const favorite = store.favorites.includes(listing.id);
  const [busy, setBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState('');
  const sample = listing.id.startsWith('10000000-');
  return <View style={[s.listing, compact && { marginBottom: 12 }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={listing.title} onPress={onPress}>
      <View style={{ height: compact ? 150 : 218, backgroundColor: C.raised }}>
        {listing.images[0] ? <Image source={imageSource(listing.images[0])} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}><Icon name="tool" size={36} color={C.lime} /><T style={{ color: C.muted }}>Простір для нових ідей</T></View>}
        <View style={{ position: 'absolute', left: 14, top: 14, flexDirection: 'row', gap: 6 }}><Pill>{categoryTitle(listing.category)}</Pill>{sample ? <Pill lime>ПРИКЛАД</Pill> : null}</View>
        {listing.status !== 'active' ? <View style={{ position: 'absolute', left: 14, bottom: 14 }}><Pill>{listing.status === 'closed' ? 'ЗАВЕРШЕНО' : 'ПРИХОВАНО'}</Pill></View> : null}
        {listing.moderation_status && listing.moderation_status !== 'approved' ? <View style={{ position: 'absolute', left: 14, bottom: 14 }}><Pill lime>{listing.moderation_status === 'pending' ? 'НА ПЕРЕВІРЦІ' : 'ВІДХИЛЕНО'}</Pill></View> : null}
      </View>
      <View style={{ padding: 18, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between', gap: 8 }}><T style={{ fontSize: 11, color: C.muted, flex: 1 }} numberOfLines={1}>{listing.team_name || 'Заявка на роботи'}</T><Row style={{ gap: 4 }}><Icon name="map-pin" color={C.muted} size={12} /><T style={{ color: C.muted, fontSize: 11 }}>{listing.city}</T></Row></Row>
        <T weight="bold" style={{ fontSize: 19, lineHeight: 27 }} numberOfLines={2}>{listing.title}</T>
        <Row style={{ justifyContent: 'space-between', paddingTop: 4 }}><T weight="bold" style={{ color: C.lime, fontSize: 16 }}>{priceLabel(listing)}</T><Icon name="arrow-up-right" color={C.lime} size={21} /></Row>
        {listing.kind === 'request' ? <T style={{ color: C.muted, fontSize: 10 }}>{shortDate(listing.created_at)}</T> : null}
      </View>
    </Pressable>
    <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={favorite ? 'Прибрати з обраного' : 'Додати в обране'} onPress={async () => { setBusy(true); setFavoriteError(''); try { await store.toggleFavorite(listing.id); } catch { setFavoriteError('Не вдалося зберегти. Спробуй ще раз.'); } finally { setBusy(false); } }} style={{ position: 'absolute', right: 14, top: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: favorite ? C.lime : '#10120FD9', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="heart" color={favorite ? C.dark : C.text} size={18} />
    </Pressable>
    {favoriteError ? <T style={{ padding: 12, color: C.danger, fontSize: 12 }}>{favoriteError}</T> : null}
  </View>;
}
export function ChoiceModal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  return <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' }}>
      <View style={{ backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', paddingBottom: 28, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginTop: 12 }} />
        <Header title={title} right={<RoundButton icon="x" label="Закрити" onPress={onClose} />} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, paddingTop: 8 }}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}
export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  round: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  input: { minHeight: 54, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 16, color: C.text, fontFamily: fonts.regular, fontSize: 14, borderWidth: 1, borderColor: C.line },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 30, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { alignSelf: 'flex-start', backgroundColor: '#15180FE6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, maxWidth: 220 },
  empty: { padding: 30, paddingVertical: 50, alignItems: 'center', gap: 16 },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, gap: 10, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  listing: { backgroundColor: C.card, borderRadius: 22, overflow: 'hidden', marginBottom: 22, borderColor: '#2C3027', borderWidth: 1 },
});
