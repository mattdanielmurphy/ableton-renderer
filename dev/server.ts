import express from 'express'
import fs from 'fs'
import os from 'os'
import { spawn } from 'child_process'
const app = express()
const port = 3000

app.listen(port, () => {
	console.log(`Server listening at http://localhost:${port}`)
})

// ! < INITIALIZE VARIABLES FROM CLI ARGS >
const workingDir = process.env.PWD!
const splitPwd = workingDir.split('-')
const macRunningThis = splitPwd[splitPwd.length - 1]
console.log('Mac running this =', macRunningThis)
const [
	pathToMasterFolder,
	pathToOutputFolder,
	,
	,
	startSession,
	endSession,
	rerenderString,
] = process.argv.slice(2)
const startComputer = Number(process.argv[4])
const endComputer = Number(process.argv[5])

console.log(`arguments provided:
masterFolder: ${pathToMasterFolder}
outputFolder: ${pathToOutputFolder}
startComputer: ${startComputer}
endComputer: ${endComputer}
`)

if (
	!pathToMasterFolder ||
	!pathToOutputFolder ||
	!startComputer ||
	!endComputer
)
	console.log(
		'Error! Some arguments were not found.\nUsage: "yarn dev <pathToMasterFolder> <pathToOutputFolder> <startComputer> <endComputer> <startSession> <endSession> [rerenderString]"',
	)

let computer = Number(startComputer)
let session = Number(startSession || 1)
// ! </ INITIALIZE VARIABLES FROM CLI ARGS >

function renderNextSession() {
	const pathToAbletonSession =
		pathToMasterFolder +
		`/COMPUTER ${computer}/GOFD ${session}00 MASTER SESSION DONE` +
		rerenderString
			? '17-bar fix for ending pitch error.als'
			: '.als'

	if (computer > endComputer) {
		console.log(
			`✔ Done rendering all sessions from computer ${startComputer} to ${endComputer}.`,
		)
	} else {
		console.log('rendering next session...', computer, session)
		try {
			const child = spawn('tsnd', [
				'dev/render.ts',
				pathToAbletonSession,
				pathToOutputFolder,
				String(computer),
				String(session),
				macRunningThis,
				rerenderString,
			])
			child.stdout.setEncoding('utf8')
			child.stdout.on('data', (data) => console.log(data))
			child.stderr.setEncoding('utf8')
			child.stderr.on('data', (data) => console.log('ERR:', data))
		} catch (err) {}
	}

	// // ? Increment session for next time
	if (session === Number(endSession || 10)) {
		computer++
		session = 1
	} else session++
	// ? Increment session for next time
	// if (session === 2) {
	// 	computer++
	// 	session = 1
	// } else session++
}

app.get('/done-render', (req, res) => {
	renderNextSession()
	res.send()
})

renderNextSession()
