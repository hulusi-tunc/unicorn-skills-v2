export const A = () => (
  <View>
    <Tile value={x} onPress={() => go('/a')} />
    <Tile
      value={y}
      onPress={() => router.push({ pathname: '/b', params: { id: 1 } })}
    />
    <Card style={{ padding: 8 }}>
      <Text>Outer</Text>
      <Card onPress={() => open()}>Inner</Card>
    </Card>
    <Card>Solo</Card>
    <Card>Next</Card>
  </View>
)
