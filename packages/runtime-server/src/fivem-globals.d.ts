/**
 * Minimal FXServer globals used by the runtime layer.
 * Kept narrow on purpose: any new global must be reviewed against the
 * concept and the GUARDS before being added here. The wider native
 * surface lives in @nextvm/natives.
 */

declare function on(eventName: string, handler: (...args: unknown[]) => void): void
declare function onNet(eventName: string, handler: (...args: unknown[]) => void): void
declare function emitNet(eventName: string, target: number | string, ...args: unknown[]): void
declare function setTick(handler: () => void): number
declare function clearTick(id: number): void
declare function GetCurrentResourceName(): string
declare function GetPlayerName(source: string): string
declare function GetNumPlayerIdentifiers(source: string): number
declare function GetPlayerIdentifier(source: string, index: number): string | undefined
declare function DropPlayer(source: string, reason: string): void
declare function deferralsDefer(): void

declare const source: number
