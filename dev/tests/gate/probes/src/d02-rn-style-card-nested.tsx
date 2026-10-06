import { View, Text, StyleSheet } from 'react-native'
export const A = () => (
  <View style={styles.card}>
    <View style={styles.card}>
      <Text>Inner</Text>
    </View>
  </View>
)
const styles = StyleSheet.create({ card: { borderRadius: 12, padding: 16, borderWidth: 1 } })
