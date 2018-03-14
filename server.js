const axios = require('axios')
const bodyParser = require('body-parser')
const express = require('express')
const coins = require('./coinsList')
const differenceInCalendarDays = require('date-fns/difference_in_calendar_days')
const utilities = require('./utilities')
const currencyList = require('./currencyList')

const app = express()
app.use(bodyParser.json())

const PORT = process.env.NODE_ENV === 'production' ? 443 : 3000
const INITIAL_HISTORY_LIMIT = 5
const TEST_TO_TS = 1520812800

app.get('/', (req, res) => res.send('Hello now!'))

app.get('/fullCoinList', (req, res) => {
	res.json({
		success: true,
		data: coins,
	})
})

const getOutOfDateCoinsFromCurrentList = () => {
	const today = new Date(utilities.getCurrentUTCTime())
	const outOfDateCoins = Object.values(currencyList.getAll()).filter(
		coin => !utilities.daysAreTheSame(today, new Date(coin.timeTo * 1000)),
	)
	if (outOfDateCoins.length > 0) {
		utilities.logger(
			`${outOfDateCoins.length} coins are out of date and need updating!`,
		)
		return getLatestDataForCurrentCoins(outOfDateCoins)
	}
}

const getLatestDataForCurrentCoins = async coinsToFetch => {
	console.log('coins to fetch: ', coinsToFetch)
	const today = new Date(utilities.getCurrentUTCTime())
	const fetchedCoinPromises = coinsToFetch.map(coin => {
		const limit = differenceInCalendarDays(today, new Date(coin.timeTo * 1000))
		return axios.get(
			`https://min-api.cryptocompare.com/data/histoday?fsym=${
				coin.symbol
			}&tsym=USD&limit=${limit}`,
		)
	})
	const coinsHistoricQuoteUpdates = await axios.all(fetchedCoinPromises).then(
		axios.spread((...args) => {
			// Both requests are now complete
			return args.map(item => item.data)
		}),
	)
	utilities.logger('Fetched all coins!', coinsHistoricQuoteUpdates)

	// Save all coins to DB and update current coin list
	const [
		database,
		historicQuotesCollection,
	] = await utilities.getDatabaseCollection('History')
	return coinsHistoricQuoteUpdates.forEach(async (updatedCoin, index) => {
		const updatedCoinWithLastFetchedDateRemoved = updatedCoin.Data.filter(
			item => item.time !== coinsToFetch[index].timeTo,
		)
		await historicQuotesCollection.updateOne(
			{ symbol: coinsToFetch[index].symbol },
			{
				$set: {
					timeTo: updatedCoin.TimeTo,
				},
				$push: {
					history: {
						$each: updatedCoinWithLastFetchedDateRemoved,
					},
				},
			},
			{
				upsert: true,
			},
		)
		const newCoinsList = await utilities.queryCollection(
			historicQuotesCollection,
			{
				symbol: coinsToFetch[index].symbol,
			},
		)
		const newCoinsHistoryQuotes = {
			symbol: newCoinsList.symbol,
			timeFrom: newCoinsList.TimeFrom,
			timeTo: newCoinsList.TimeTo,
			history: newCoinsList.Data,
			conversionTo: 'USD',
		}
		utilities.updateCoinsList(newCoinsHistoryQuotes)
	})
}

app.get('/list', async (req, res) => {
	await getOutOfDateCoinsFromCurrentList()
	res.send({ success: true, data: getCurrentCoins.getAll() })
})

app.post('/add_coin', async (req, res) => {
	const symbol = req.body.symbol
	if (!utilities.symbolIsValid(symbol)) {
		return utilities.returnError(res, utilities.getSymbolErrorMessage(symbol))
	}
	utilities.logger('Symbol is valid')
	try {
		const [
			database,
			historicQuotesCollection,
		] = await utilities.getDatabaseCollection('History')
		const coinsHistoricQuotes = await utilities.queryCollection(
			historicQuotesCollection,
			{
				symbol,
			},
		)
		utilities.logger(
			`historicQuotes is defined: ${utilities.isDefined(coinsHistoricQuotes)}`,
		)
		if (utilities.isDefined(coinsHistoricQuotes)) {
			// Yay, we have the coin
			// If the last time we retrieved data is today, then just return, otherwise we need to update
			const lastFetchDate = new Date(coinsHistoricQuotes.timeTo * 1000)
			const startOfToday = new Date(utilities.getCurrentUTCTime())
			if (utilities.daysAreTheSame(lastFetchDate, startOfToday)) {
				utilities.logger('Found coin in db, and is current. Returning to user.')
				utilities.updateCoinListAndReturnToUser(res, coinsHistoricQuotes)
			} else {
				// We don't have the lastest, so we need to get from lastFetchDate, to now
				utilities.logger('Found coin in db, but out of date. updating...')
				const limit = differenceInCalendarDays(startOfToday, lastFetchDate)
				const uri = `https://min-api.cryptocompare.com/data/histoday?fsym=${symbol}&tsym=USD&limit=${limit}&toTs=${TEST_TO_TS}`
				utilities.logger(uri)
				const coinsHistoricQuoteUpdates = await axios.get(uri)
				const updatedHistoryWithLastFetchedDateRemoved = coinsHistoricQuoteUpdates.data.Data.filter(
					item => item.time !== coinsHistoricQuotes.timeTo,
				)
				utilities.logger(`Old timeTo: ${coinsHistoricQuotes.timeTo}`)
				utilities.logger(`New timeTo: ${coinsHistoricQuoteUpdates.data.TimeTo}`)
				// utilities.logger(updatedHistoryWithLastFetchedDateRemoved)
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
				utilities.logger('Updated to db!')
				const newCoinsHistoryQuotes = {
					...coinsHistoricQuotes,
					timeTo: coinsHistoricQuoteUpdates.data.TimeTo,
					history: [
						...coinsHistoricQuotes.history,
						...updatedHistoryWithLastFetchedDateRemoved,
					],
				}
				utilities.updateCoinListAndReturnToUser(res, newCoinsHistoryQuotes)
			}
		} else {
			// We don't have the coin so we definitely need to fetch it
			const coinsHistoricQuotes = await axios.get(
				`https://min-api.cryptocompare.com/data/histoday?fsym=${symbol}&tsym=USD&limit=${INITIAL_HISTORY_LIMIT}&toTs=${TEST_TO_TS}`,
			)
			// We have the data, so save back to local db
			utilities.logger('Have fetched the new coin!')
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
			utilities.logger('Updated new coin to db!')
			utilities.updateCoinListAndReturnToUser(res, newCoinsHistoryQuotes)
		}
		database.close()
	} catch (err) {
		utilities.returnError(res, err)
	}
})

app.post('/remove_coin', (req, res) => {
	const symbol = req.body.symbol
	utilities.removeCoin(symbol)
	res.json({
		success: true,
	})
})

app.listen(PORT, () => {
	// TODO: Get the last_fetched_date from the database
	utilities.logger(`Example app listening on port ${PORT}!`)
})
