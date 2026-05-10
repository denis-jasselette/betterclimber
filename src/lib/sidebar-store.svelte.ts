/**
 * Shared sidebar open/close state.
 * Updated by the root layout; consumed by TopBar instances in each page.
 */

let open = $state(false)

export const sidebarStore = {
	get open() {
		return open
	},
	set open(val: boolean) {
		open = val
	},
	toggle() {
		open = !open
	},
	close() {
		open = false
	}
}
