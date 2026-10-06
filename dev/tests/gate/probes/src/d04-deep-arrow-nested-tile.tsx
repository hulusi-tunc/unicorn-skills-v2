export const A = ({ track }: { track: (e: object) => void }) => (
  <Tile onPress={() => { track({ event: 'tap', props: { id: 1 } }) }}>
    <Tile>Inner</Tile>
  </Tile>
)
