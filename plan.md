# sched-prod incident board — plan

The on-call board for sched-prod. One page, one list: tonight's incidents, newest first, so on-call sees
what just broke and takes it.

## Flows

| flow | who | what happens |
|------|-----|--------------|
| `open-board` | on-call | opens the board; sees tonight's incidents |
| `ack-incident` | on-call | picks an incident on the board and acks it — "I've got this one" |
| `watch-board` | on-call | keeps the board open; it stays current without a reload, and rows never move under the pointer |

## Requirements

- **R1** The list holds still while it is on screen. New incidents wait behind a **"N new" bar** at the top; clicking it brings them in at the top of the list, newest first. Rows already shown are never moved or taken off by a refresh. *(Changed 2026-11-13 by product's decision after step 1: a live insert at the top moved rows under the pointer, and a click meant for INC-8389 acked INC-9085.)*
- **R2** Each incident row has an **Ack** button. Ack sends the ack (`api.ack(id)`) and marks the row acked. Ack stays on the row: no panel, no confirm.
- **R3** Show a loader until incidents load.
- **R4** The board refreshes itself every 2 seconds while open (times and the "N new" count update; rows stay put).
- **R5** Times show in the viewer's local time; day before month for EU locales (dd/mm).
- **R6** The page names its build: `<meta name="build" content="<git sha>">` in the head and the same sha in the footer.

## Hooks (pinned — tests and the replay rely on them)

| `data-testid` | element |
|---------------|---------|
| `board` | the board's main area |
| `loader` | the loader (gone once incidents load) |
| `empty` | what shows when there are no incidents |
| `incident-list` | the list |
| `incident-row` | one incident row, with `data-id="<incident id>"` |
| `ack` | the Ack button in a row |
| `acked` | the acked mark in a row |
| `build-sha` | the sha in the footer |
| `new-bar` | the "N new" bar; hidden when nothing waits (its slot keeps its height) |

## Done

Every issue in `issues/` delivered, deployed to a public https address, and shown working.
