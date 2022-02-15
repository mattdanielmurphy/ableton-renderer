import { copyToClipboard, pause } from './utilities'

import { Ableton } from 'ableton-js'
import { Track } from 'ableton-js/ns/track'
import { exec } from 'child_process'

async function runResetViewAfter15s(
	computerNumber: number,
	sessionNumber: number,
	macRunningThis: string,
	outputDir: string,
) {
	waitingToRenderSession = false
	copyToClipboard(
		`${computerNumber}-${sessionNumber}-${macRunningThis}-${outputDir}`,
	)
	console.log(
		`computerNumber (${computerNumber}) and sessionNumber (${sessionNumber}) copied to clipboard`,
	)
	console.log('running resetView after 15s')
	await pause(15)
	exec(
		`osascript -e 'tell application "Keyboard Maestro Engine" to do script "ABLETON: RESET VIEW & SELECT ALL"'`,
		(err, stdout, stderr) => {
			if (err) throw err
		},
	)
}

async function dontSavePrevSession() {
	exec(
		`osascript -e 'tell application "Keyboard Maestro Engine" to do script "ABLETON: CLICK DONT SAVE"'`,
		(err) => {
			if (err) throw err
		},
	)
}

async function cancelAllMacros() {
	exec(
		`osascript -e 'tell application "Keyboard Maestro Engine" to do script "Cancel all macros"'`,
		(err) => {
			if (err) throw err
		},
	)
}

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

function restartMidiScript() {
	exec(
		`osascript -e 'tell application "Keyboard Maestro Engine" to do script "ABLETON: RESTART MIDI SCRIPT"'`,
		(err) => {
			if (err) throw err
		},
	)
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
			runResetViewAfter15s(
				computerNumber,
				sessionNumber,
				macRunningThis,
				outputDir,
			)
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
	const [pathToAbletonSession, outputDir] = process.argv.slice(2)
	const computer = Number(process.argv[4])
	const session = Number(process.argv[5])
	const macRunningThis = process.argv[6]
	waitingToRenderSession = true
	const abletonRunning = await isAbletonRunning()
	cancelAllMacros()
	await pause(2)

	if (!abletonRunning) throw new Error('Open Ableton first')
	console.log(`opening session "${pathToAbletonSession}"`)
	exec(`open "${pathToAbletonSession}"`)
	await pause(1)
	dontSavePrevSession()

	onAbletonConnect(computer, session, macRunningThis, outputDir)
}

let waitingToRenderSession = false

renderSession()
