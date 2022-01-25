import { spawn } from 'child_process'

export async function pause(seconds: number) {
	return await new Promise<void>((resolve, reject) =>
		setTimeout(() => resolve(), seconds * 1000),
	)
}

export function copyToClipboard(data: string) {
	var proc = spawn('pbcopy')
	proc.stdin.write(data)
	proc.stdin.end()
}
