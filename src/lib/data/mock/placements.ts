import type { Placement } from '../types'
import placementsJSON from './placements.json'

const placements: Placement[] = placementsJSON

const placementsMap = new Map(placements.map((x) => [x.id, x]))

export function getPlacementById(placementId: number): Placement | undefined {
	return placementsMap.get(placementId)
}
