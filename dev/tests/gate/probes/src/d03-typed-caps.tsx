import { Text, StyleSheet } from 'react-native'
export const A = () => <Text style={styles.label}>YOUR BALANCE</Text>
export const B = () => <p className="tracking-widest text-xs">FEATURES</p>
const styles = StyleSheet.create({ label: { letterSpacing: 0.6 } })
