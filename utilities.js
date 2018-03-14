const MongoClient = require('mongodb').MongoClient
const coins = require('./coinsList')

const MONGO_URI = process.env.MONGO_URI
const DATABASE_NAME = process.env.DATABASE_NAME

const getDatabaseCollection = async collectionName => {
	try {
		const database = await MongoClient.connect(MONGO_URI + DATABASE_NAME)
		return [database, database.db(DATABASE_NAME).collection('History')]
	} catch (err) {
		console.log('Error: ', err)
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

const logger = (message, ...args) => {
	if (process.env.NODE_ENV !== 'production') {
		console.log(message, ...args)
	}
}

const symbolIsValid = symbol => isDefined(symbol) && isDefined(coins[symbol])

const getSymbolErrorMessage = symbol => {
	if (!isDefined(symbol)) {
		return 'must supply symbol'
	}
	if (!isDefined(coins[symbol])) {
		return 'not a valid symbol'
	}
}

const returnError = (res, err) => {
	logger(err)
	res.json({
		Error: err,
	})
}

module.exports = {
	getDatabaseCollection,
	queryCollection,
	daysAreTheSame,
	getCurrentUTCTime,
	isDefined,
	logger,
	symbolIsValid,
	getSymbolErrorMessage,
	returnError,
}
