export const A = ({ track }: { track: (e: object) => void }) => (
  <>
    <Tile onPress={() => { track({ event: 'tap', props: { id: 1 } }) }}>
      <Text>A</Text>
    </Tile>
    <Tile onPress={() => track({ id: 2 })}>
      <Text>B</Text>
    </Tile>
  </>
)
