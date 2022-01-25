import { Ableton } from 'ableton-js'
import { Track } from 'ableton-js/ns/track'
import { exec } from 'child_process'

function pbcopy(data: string) {
	var proc = require('child_process').spawn('pbcopy')
	proc.stdin.write(data)
	proc.stdin.end()
}

async function resetView(computerNumber: number, sessionNumber: number) {
	const macRunningThis = process.argv[5]
	if (process.argv[5] === '--dont-open')
		pbcopy(`${computerNumber}-${sessionNumber}-${macRunningThis}`)
	console.log(
		`computerNumber (${computerNumber}) and sessionNumber (${sessionNumber}) copied to clipboard`,
	)
	exec(
		`osascript -e 'tell application "Keyboard Maestro Engine" to do script "ABLETON: RESET VIEW & SELECT ALL"'`,
		(err, stdout, stderr) => {
			if (err) throw err
		},
	)
}

async function pause(seconds: number) {
	return await new Promise<void>((resolve, reject) =>
		setTimeout(() => resolve(), seconds * 1000),
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

async function expandTracks(tracks: Track[]) {
	console.log('folding and unfolding tracks')
	// const namesOfTracksToExpand = [
	// 	'All',
	// 	'7GOFD ALL FX (Nov29)',
	// 	'6FILTERS',
	// 	'4MELODIC',
	// 	'Main Clips',
	// 	// '3J37 MEL2',
	// 	// '3J37 Perc',
	// 	// '2Ambient',
	// 	// '2FILT DRUMS',
	// ]
	for (const track of tracks) {
		try {
			await track.set('fold_state', 0)
		} catch (error) {}
		// if (namesOfTracksToExpand.includes(track.raw.name)) {
		// 	console.log('folding', track.raw.name)
		// 	await track.set('fold_state', 0)
		// }
		// else await track.set('fold_state', 1) //? COMMENTED OUT b/c causes an error
	}
	console.log('done expanding')
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
	dontOpen: boolean,
	computerNumber: number,
	sessionNumber: number,
) {
	const ableton = new Ableton()
	ableton.on('connect', async () => {
		console.log('connected! waiting 15s for samples to finish loading')
		if (!dontOpen) await pause(15)
		console.log('disabling output track')
		const tracks = await ableton.song.get('tracks')
		await expandTracks(tracks)
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
		console.log('starting resetView macro (which runs the rest of the macros)')
		resetView(computerNumber, sessionNumber)
	})
}

async function renderSession(
	pathToAbletonSession: string = process.argv[2],
	computerNumber: number,
	sessionNumber: number,
) {
	const abletonRunning = await isAbletonRunning()
	cancelAllMacros()
	await pause(2)
	const dontOpen = process.argv[6] === '--dont-open'

	if (abletonRunning) {
		console.log('ableton is running')
		if (dontOpen) {
			console.log(`Using option --don\'t-open... refreshing midi script`)
			restartMidiScript()
		} else {
			console.log(`opening session "${pathToAbletonSession}"`)
			exec(`open "${pathToAbletonSession}"`)
			await pause(1)
			dontSavePrevSession()
		}
	} else {
		throw new Error('Open Ableton first')
		// console.log(`opening session "${pathToAbletonSession}"`)
		// exec(`open "${pathToAbletonSession}"`)
		// console.log('waiting 15s… (Ableton was not open)')
		// await pause(15)
	}

	try {
		onAbletonConnect(dontOpen, computerNumber, sessionNumber)
	} catch (error) {
		if (error) {
			console.log('got error onAbletonConnect, trying again in 5s')
			setTimeout(
				() => onAbletonConnect(dontOpen, computerNumber, sessionNumber),
				5000,
			)
		}
	}
}

// ! < INITIALIZE VARIABLES FROM CLI ARGS >
const [pathToAbletonSession] = process.argv.slice(2)
const computer = Number(process.argv[3])
const session = Number(process.argv[4])
// ! </ INITIALIZE VARIABLES FROM CLI ARGS >

renderSession(pathToAbletonSession, computer, session)
