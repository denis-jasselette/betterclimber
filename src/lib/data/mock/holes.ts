import type { Hole } from '../types'
import holesJSON from './holes.json'

const holes: Hole[] = holesJSON

const holesMap = new Map(holes.map((x) => [x.id, x]))

export function getHoleById(holeId: number): Hole | undefined {
	return holesMap.get(holeId)
}
