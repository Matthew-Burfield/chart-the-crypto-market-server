const axios = require('axios')
const bodyParser = require('body-parser')
const express = require('express')
const MongoClient = require('mongodb').MongoClient
const coins = require('./coinsList')

const app = express()
app.use(bodyParser.json())

const MONGO_URI = process.env.MONGO_URI
const PORT = process.env.NODE_ENV === 'production' ? 443 : 3000

const listOfCoins = {}

app.get('/', (req, res) => res.send('Hello now!'))

app.get('/fullCoinList', (req, res) => res.json(coins))

app.get('/list', (req, res) => res.send(listOfCoins))

app.post('/add_coin', async (req, res) => {
	const symbol = req.body.symbol
	listOfCoins[symbol] = symbol
	if (!symbol) {
		res.json({
			Error: 'must supply coin symbol',
		})
	}
	// TODO: Check the database to see if this coin exists
	try {
		const database = await MongoClient.connect(MONGO_URI)
		const historicQuotesCollection = database
			.db('chart-the-crypto-market')
			.collection('History')
		const results = await historicQuotesCollection
			.find({
				symbol,
			})
			.toArray()
		if (results.length > 0) {
			// Yay, we have the coin
			res.json(results)
		} else {
			// We don't have the coin so we definitely need to fetch it
			axios
				.get(
					`https://min-api.cryptocompare.com/data/histoday?fsym=${symbol}&tsym=USD&limit=1`,
				)
				.then(result => result.data)
				.then(async data => {
					// We have the data, so save back to local db
					console.log(data)
					try {
						const update = await historicQuotesCollection.updateOne(
							{ symbol },
							{
								$set: {
									symbol,
									timeFrom: data.TimeFrom,
									timeTo: data.TimeTo,
									history: data.Data,
									conversionTo: 'USD',
								},
							},
							{
								upsert: true,
							},
						)
						console.log(update)
						res.json({
							success: true,
						})
					} catch (err) {
						console.log(err)
						res.send(err)
					}
				})
				.catch(err => {})
		}
	} catch (err) {
		console.log(err)
		res.send(err)
	}

	// TODO: If coin doesn't exist or if last fetch date is before yesterday, fetch coin again from API
	// https://min-api.cryptocompare.com/data/histoday?fsym=BTC&tsym=USD&limit=10000

	// TODO: Add coin to listOfCoins, return new coin to users
})

app.post('/remove_coin', (req, res) => {
	const coinCode = req.body.coinCode
	listOfCoins = listOfCoins.filter(coin => coin.code === coinCode)
})

app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
