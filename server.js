const express = require('express')
const bodyParser = require('body-parser')
const MongoClient = require('mongodb').MongoClient

const app = express()
app.use(bodyParser.json())

const MONGO_URI = process.env.MONGO_URI
const PORT = process.env.NODE_ENV === 'production' ? 443 : 3000

const listOfCoins = {
	BTC: {
		name: 'Bitcoin',
		code: 'BTC',
	},
	LTC: {
		name: 'Litecoin',
		code: 'LTC',
	},
	ETC: {
		name: 'Etherium',
		code: 'ETC',
	},
}

app.get('/', (req, res) => res.send('Hello now!'))

app.get('/list', (req, res) => res.send(listOfCoins))

app.get('/db', (req, res) => res.send(MONGO_URI))

app.post('/add_coin', (req, res) => {
	const coinCode = req.body.coinCode
	// TODO: Check the database to see if this coin exists

	// TODO: If coin doesn't exist or if last fetch date is before yesterday, fetch coin again from API

	// TODO: Add coin to listOfCoins, return new coin to users
})

app.post('/remove_coin', (req, res) => {
	const coinCode = req.body.coinCode
	listOfCoins = listOfCoins.filter(coin => coin.code === coinCode)
})

app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
