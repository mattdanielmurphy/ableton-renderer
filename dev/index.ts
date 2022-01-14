import { Ableton } from 'ableton-js'
import { exec } from 'child_process'
import express from 'express'
const app = express()
const port = 3000

app.listen(port, () => {
	console.log(`Server listening at http://localhost:${port}`)
})

const ableton = new Ableton()

function pbcopy(data: string) {
	var proc = require('child_process').spawn('pbcopy')
	proc.stdin.write(data)
	proc.stdin.end()
}

async function resetView(computerNumber: number, sessionNumber: number) {
	pbcopy(`${computerNumber}-${sessionNumber}`)
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
		`osascript -e 'tell application "Keyboard Maestro Engine" to do script "DD05E63C-694C-4E98-8B9E-AD3AA16B77FE"'`,
		(err) => {
			if (err) throw err
		},
	)
}

async function cancelAllMacros() {
	exec(
		`osascript -e 'tell application "Keyboard Maestro Engine" to do script "DD544012-DAC5-47E3-A194-7A930DD27F80"'`,
		(err) => {
			if (err) throw err
		},
	)
}

async function isAbletonRunning() {
	return await new Promise((resolve, reject) => {
		exec(`pgrep -xq -- "Live" && echo 'running'`, (err, stdout, stderr) => {
			if (err) throw err
			resolve(stdout)
		})
	})
}

async function renderSession(
	pathToAbletonSession: string = process.argv[2],
	computerNumber: number,
	sessionNumber: number,
) {
	console.log(`opening session "${pathToAbletonSession}"`)

	const abletonRunning = await isAbletonRunning()
	exec(`open "${pathToAbletonSession}"`)

	cancelAllMacros()
	if (!abletonRunning) await pause(8)
	dontSavePrevSession()

	ableton.on('connect', async () => {
		console.log('disabling output track')
		const tracks = await ableton.song.get('tracks')
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
		console.log('pausing for 15 seconds')
		await pause(15)
		console.log('executing resetView')
		resetView(computerNumber, sessionNumber)
	})
}

// ! < INITIALIZE VARIABLES FROM CLI ARGS >
const [pathToMasterFolder] = process.argv.slice(2)
const startComputer = Number(process.argv[3])
const endComputer = Number(process.argv[4])

if (!pathToMasterFolder || !startComputer || !endComputer)
	throw 'Error! Some arguments were not found.\nUsage: "yd <pathToMasterFolder> <startComputer> <endComputer>"'

let computer = Number(startComputer)
let session = 1
// ! </ INITIALIZE VARIABLES FROM CLI ARGS >

async function renderNextSession() {
	const pathToAbletonSession =
		pathToMasterFolder +
		`/COMPUTER ${computer}/GOFD ${session}00 MASTER SESSION DONE.als`

	if (computer > endComputer) {
		console.log(
			`✔ Done rendering all sessions from computer ${startComputer} to ${endComputer}.`,
		)
	} else {
		console.log('rendering next session...', computer, session)
		renderSession(pathToAbletonSession, computer, session)
	}

	// ? Increment session for next time
	if (session === 10) {
		computer++
		session = 0
	} else session++
}

app.get('/done-render', (req, res) => {
	renderNextSession()
})

renderNextSession()

// const pathToAbletonSession =
// 	'/Volumes/Extreme SSD/GFOD Project Links/COMPUTER 3/GOFD 100 MASTER SESSION DONE.als'

// renderSession(pathToAbletonSession, 3, 1)
