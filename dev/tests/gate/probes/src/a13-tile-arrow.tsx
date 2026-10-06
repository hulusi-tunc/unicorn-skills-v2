export const A = ({ go }: { go: (s: string) => void }) => (
  <>
    <Tile onPress={() => go('a')}>
      <Text>A</Text>
    </Tile>
    <Tile onPress={() => go('b')}>
      <Text>B</Text>
    </Tile>
    <Tile onPress={() => go('c')} />
    <Tile onPress={() => go('d')} />
  </>
)
