//Requires
require('dotenv').config()

//Telegram specific inits
const TelegramBot = require('node-telegram-bot-api')
const token = process.env.TG_TOKEN
const bot = new TelegramBot(token, {polling: true})

//Google Sheets inits
const fs = require('fs')
const readline = require('readline')
const {google} = require('googleapis')

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
const TOKEN_PATH = './token.json'

//load client secrets from local file
fs.readFile('credentials.json', (err, content) =>{
	if (err) return console.error('Error loading client secret file:', err)

	authorize(JSON.parse(content), listAssignments)
})

//Create OAuth2 client with given credentials
const authorize = (credentials, callback) => {
	const {client_secret, client_id, redirect_uris} = credentials.installed
	const oAuth2Client = new google.auth.OAuth2(
		client_id, client_secret, redirect_uris[0]
	)

	fs.readFile(TOKEN_PATH, (err, token) => {
		if (err) return getNewToken(oAuth2Client, callback)
		oAuth2Client.setCredentials(JSON.parse(token))
		callback(oAuth2Client)
	})
}

//Get and store new token after prompting user auth
//Then execute given callback with authorized OAuth client
const getNewToken = (oAuth2Client, callback) => {
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES
	})
	console.log('Authorize this app by visiting:', authUrl)
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	})
	rl.question('Enter code from that page here: ', (code) => {
		rl.close()
		oAuth2Client.getToken(code, (err, token) => {
			if (err) return console.error('Error while trying to retrieve access token', err)
			oAuth2Client.setCredentials(token)
			//Store token to disk
			fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
				if (err) return console.error(err)
				console.log('Token stored to ', TOKEN_PATH)
			})
		callback(oAuth2Client)
		})
	})
}

//Read Google Sheets file and print out stuff
const listAssignments = (auth) => {
	const sheets = google.sheets({version: 'v4', auth})
	sheets.spreadsheets.values.get({
		spreadsheetId: '1AHPW5Gsb-A-m5-FCH7jHATyByakLlnclsEMXjrD0_UM',
		range: 'A2:G'
	}, (err, res) => {
		if (err) return console.error('API returned an error: ', err)
		const rows = res.data.values
		if (rows.length) {
			console.log('Kurssi, Tehtävä, Palautuspäivä')
			rows.map((row) => {
				console.log(`${row[0]}, ${row[2]}, ${row[4]}`)
			})
			//Write found course details and dates to json file
			fs.writeFile('courses.json', `[
				${rows.map((row) => {
				return `
					{"name": "${row[0]}", 
					"assignment": "${row[2]}", 
					"due": "${row[4]}"}`
			})}]`, (err) => {
				if (err)
					return console.error('Error writing file: ', err)
				console.log('Saved courses to file!')
			})

		} else {
			console.log('No data found')
		}
	})
}
//Send message to user
const startBot = () => {
	const messageContent = JSON.parse(fs.readFileSync('courses.json', 'utf-8'))
	console.log(messageContent)
	
	bot.onText(/\/assignments/, (msg) => {
		bot.sendMessage(msg.chat.id, `${messageContent.map((content) => {
			return `${content.name}, ${content.assignment}, ${content.due}`
		})}`)
		})
	}

startBot()