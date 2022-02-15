import { copyToClipboard, pause } from './utilities'

import { Ableton } from 'ableton-js'
import { Track } from 'ableton-js/ns/track'
import { exec } from 'child_process'
import fs from 'fs'

function getArgs() {
	const args = process.argv
	return {
		pathToAbletonSession: args[2],
		outputDir: args[3],
		computer: Number(args[4]),
		session: Number(args[5]),
		macRunningThis: args[6],
	}
}

function copyVariablesToClipboard(
	computerNumber: number,
	sessionNumber: number,
	macRunningThis: string,
	outputDir: string,
) {
	copyToClipboard(
		`${computerNumber}-${sessionNumber}-${macRunningThis}-${outputDir}`,
	)
	console.log(
		`computerNumber (${computerNumber}) and sessionNumber (${sessionNumber}) copied to clipboard`,
	)
}

async function runKeyboardMaestroMacro(
	macroName: string,
	callback?: () => void,
) {
	exec(
		`osascript -e 'tell application "Keyboard Maestro Engine" to do script "${macroName}"'`,
		callback,
	)
}

const runResetView = async () => {
	runKeyboardMaestroMacro('ableton: reset view & select all')
}
const restartMidiScript = () =>
	runKeyboardMaestroMacro('ableton: restart midi script')

const dontSavePrevSession = () =>
	runKeyboardMaestroMacro('ableton: click dont save')

const cancelAllMacros = () => runKeyboardMaestroMacro('cancel all macros')

async function isAbletonRunning() {
	return await new Promise((resolve, reject) => {
		exec(
			`if pgrep -xq -- "Live"; then echo 'running'; fi`,
			(err, stdout, stderr) => {
				if (err) throw err
				resolve(stdout)
			},
		)
	})
}

async function expandAllTracks(tracks: Track[]) {
	for (const track of tracks) {
		await track.set('fold_state', 0).catch((rej) => {})
	}
}

async function deleteOutputTrack(tracks: Track[], ableton: Ableton) {
	tracks.reverse()
	for (let i = 0; i < tracks.length; i++) {
		const track = tracks[i]
		if (track.raw.name.includes('OUTPUT')) {
			const indexForUnreversedTracksArray = tracks.length - 1 - i
			await ableton.song.deleteTrack(indexForUnreversedTracksArray)
			console.log('deleted OUTPUT track')
			break
		}
	}
}

function onAbletonConnect(
	computerNumber: number,
	sessionNumber: number,
	macRunningThis: string,
	outputDir: string,
) {
	const ableton = new Ableton()
	ableton.on('error', (err) => {})
	ableton.on('connect', async () => {
		if (waitingToRenderSession) {
			copyVariablesToClipboard(
				computerNumber,
				sessionNumber,
				macRunningThis,
				outputDir,
			)

			console.log('running resetView after 15s')
			await pause(15)
			waitingToRenderSession = false
			runResetView()

			console.log('pausing so ableton.js doesnt fail...')
			await pause(5)

			const tracks = await ableton.song.get('tracks')
			await expandAllTracks(tracks)

			console.log('deleting output track')
			await deleteOutputTrack(tracks, ableton)
		}
	})
}

async function renderSession() {
	const { pathToAbletonSession, outputDir, computer, session, macRunningThis } =
		getArgs()

	waitingToRenderSession = true
	const abletonRunning = await isAbletonRunning()
	cancelAllMacros()
	await pause(2)

	if (!abletonRunning) {
		console.log('Opening ableton first (and waiting 20s)...')

		if (fs.existsSync('/Applications/Ableton Live 11 Suite.app'))
			exec('open "/Applications/Ableton Live 11 Suite.app"')
		else exec('open "/Applications/Ableton Live 11 Standard.app"')

		await pause(20)
	}
	console.log(`opening session "${pathToAbletonSession}"`)
	exec(`open "${pathToAbletonSession}"`)
	await pause(1)
	dontSavePrevSession()

	onAbletonConnect(computer, session, macRunningThis, outputDir)
}

let waitingToRenderSession = false

renderSession()
