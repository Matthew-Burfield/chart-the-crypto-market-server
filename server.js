const axios = require('axios')
const bodyParser = require('body-parser')
const express = require('express')
const MongoClient = require('mongodb').MongoClient
const coins = require('./coinsList')
const differenceInCalendarDays = require('date-fns/difference_in_calendar_days')

const app = express()
app.use(bodyParser.json())

const MONGO_URI = process.env.MONGO_URI
const PORT = process.env.NODE_ENV === 'production' ? 443 : 3000
const DATABASE = 'chart-the-crypto-market'
const INITIAL_HISTORY_LIMIT = 5

const listOfCoins = {}

app.get('/', (req, res) => res.send('Hello now!'))

app.get('/fullCoinList', (req, res) =>
	res.json({
		success: true,
		data: coins,
	}),
)

app.get('/list', (req, res) => res.send({ success: true, data: listOfCoins }))

const getDatabaseCollection = async collectionName => {
	try {
		const database = await MongoClient.connect(MONGO_URI)
		return [
			database,
			database.db('chart-the-crypto-market').collection('History'),
		]
	} catch (err) {
		return err
	}
}

const queryCollection = async (collection, query) => {
	return await collection.findOne(query)
}

const daysAreTheSame = (date1, date2) => {
	return (
		date1.getDate() === date2.getDate() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getFullYear() === date2.getFullYear()
	)
}

const getCurrentUTCTime = () => {
	const now = new Date() // contains timezone
	const timeZoneOffset = now.getTimezoneOffset() * 60 * 1000 // adjusted to milliseconds
	return now.getTime() + timeZoneOffset
}

const isDefined = prop => prop !== null && typeof prop !== 'undefined'

const logger = message => {
	if (process.env.NODE_ENV !== 'production') {
		console.log(message)
	}
}

const updateCoinListAndReturnToUser = (res, coinsHistoricQuotes) => {
	listOfCoins[coinsHistoricQuotes.symbol] = coinsHistoricQuotes
	res.json({
		success: true,
		data: coinsHistoricQuotes,
	})
}

app.post('/add_coin', async (req, res) => {
	const symbol = req.body.symbol
	listOfCoins[symbol] = symbol
	if (!symbol) {
		returnError('must supply symbol')
	} else if (!isDefined(coins[symbol])) {
		returnError('not a valid symbol')
	} else {
		// TODO: Check the database to see if this coin exists
		try {
			const [database, historicQuotesCollection] = await getDatabaseCollection(
				'History',
			)
			const coinsHistoricQuotes = await queryCollection(historicQuotesCollection, {
				symbol,
			})
			logger(`historicQuotes is defined: ${isDefined(coinsHistoricQuotes)}`)
			if (isDefined(coinsHistoricQuotes)) {
				// Yay, we have the coin
				// If the last time we retrieved data is today, then just return, otherwise we need to update
				const lastFetchDate = new Date(coinsHistoricQuotes.timeTo * 1000)
				const startOfToday = new Date(getCurrentUTCTime())
				if (daysAreTheSame(lastFetchDate, startOfToday)) {
					logger('here')
					updateCoinListAndReturnToUser(res, coinsHistoricQuotes)
				} else {
					// We don't have the lastest, so we need to get from lastFetchDate, to now
					logger('updating...')
					const limit = differenceInCalendarDays(startOfToday, lastFetchDate)
					const uri = `https://min-api.cryptocompare.com/data/histoday?fsym=${symbol}&tsym=USD&limit=${limit}&`
					logger(uri)
					const coinsHistoricQuoteUpdates = await axios.get(uri)
					const updatedHistoryWithLastFetchedDateRemoved = coinsHistoricQuoteUpdates.data.Data.filter(
						item => item.time !== coinsHistoricQuotes.timeTo,
					)
					logger(`Old timeTo: ${coinsHistoricQuotes.timeTo}`)
					logger(`New timeTo: ${coinsHistoricQuoteUpdates.data.TimeTo}`)
					logger(updatedHistoryWithLastFetchedDateRemoved)
					const update = await historicQuotesCollection.updateOne(
						{ symbol },
						{
							$set: {
								timeTo: coinsHistoricQuoteUpdates.data.TimeTo,
							},
							$push: {
								history: {
									$each: updatedHistoryWithLastFetchedDateRemoved,
								},
							},
						},
						{
							upsert: true,
						},
					)
					logger('Updated to db!')
					const newCoinsHistoryQuotes = {
						...coinsHistoricQuotes,
						timeTo: coinsHistoricQuoteUpdates.data.TimeTo,
						history: [
							...coinsHistoricQuotes.history,
							...updatedHistoryWithLastFetchedDateRemoved,
						],
					}
					updateCoinListAndReturnToUser(res, newCoinsHistoryQuotes)
				}
			} else {
				// We don't have the coin so we definitely need to fetch it
				const coinsHistoricQuotes = await axios.get(
					`https://min-api.cryptocompare.com/data/histoday?fsym=${symbol}&tsym=USD&limit=${INITIAL_HISTORY_LIMIT}`,
				)
				// We have the data, so save back to local db
				logger('Have fetched the new coin!')
				const newCoinsHistoryQuotes = {
					symbol,
					timeFrom: coinsHistoricQuotes.data.TimeFrom,
					timeTo: coinsHistoricQuotes.data.TimeTo,
					history: coinsHistoricQuotes.data.Data,
					conversionTo: 'USD',
				}
				const update = await historicQuotesCollection.updateOne(
					{ symbol },
					{
						$set: newCoinsHistoryQuotes,
					},
					{
						upsert: true,
					},
				)
				logger('Updated new coin to db!')
				updateCoinListAndReturnToUser(res, newCoinsHistoryQuotes)
			}
			database.close()
		} catch (err) {
			returnError(res, err)
		}
	}
})

const returnError = (res, err) => {
	logger(err)
	res.json({
		Error: err,
	})
}

app.post('/remove_coin', (req, res) => {
	const coinCode = req.body.coinCode
	listOfCoins = listOfCoins.filter(coin => coin.code === coinCode)
})

app.listen(PORT, () => logger(`Example app listening on port ${PORT}!`))
