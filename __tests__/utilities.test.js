const utilities = require('../utilities')
const coins = require('../coinsList')

describe('daysAreTheSame', () => {
	test('I can pass in two dates that are the same and get true', () => {
		const date = new Date()
		expect(utilities.daysAreTheSame(date, date)).toBe(true)
	})

	test('Expect two consecutive days to return false', () => {
		const date1 = new Date('2018-01-01')
		const date2 = new Date('2018-01-02')
		expect(utilities.daysAreTheSame(date1, date2)).toBe(false)
	})

	test('Expect two consecutive days in the new year to return false', () => {
		const date1 = new Date('2017-12-31')
		const date2 = new Date('2018-01-01')
		expect(utilities.daysAreTheSame(date1, date2)).toBe(false)
	})
})

// describe('getCurrentUTCTime', () => {
// 	test('Returns the current UTC time when called', () => {
// 		console.log(utilities.getCurrentUTCTime())
// 		console.log(new Date().getTime())
// 	})
// })

describe('isDefined', () => {
	test('Returns false when passed undefined', () => {
		expect(utilities.isDefined(void 0)).toBe(false)
	})

	test('Returns false when passed null', () => {
		expect(utilities.isDefined(null)).toBe(false)
	})

	test('Returns true when passed a string', () => {
		expect(utilities.isDefined('Hello there')).toBe(true)
	})

	test('Returns true when passed a number', () => {
		expect(utilities.isDefined(5)).toBe(true)
	})

	test('Returns true when passed an object', () => {
		expect(
			utilities.isDefined({
				property: 'value',
			}),
		).toBe(true)
	})

	test('Returns true when passed an array', () => {
		expect(utilities.isDefined([1, 2, 3])).toBe(true)
	})
})

describe('symbolIsValid', () => {
	test('returns true if we pass in a random currency', () => {
		const keys = Object.keys(coins)
		const randomKeyIndex = Math.floor(Math.random() * keys.length) + 1
		const symbol = keys[randomKeyIndex]
		expect(utilities.symbolIsValid(symbol)).toBe(true)
	})

	test('returns false if we pass in null/undefined/empty string', () => {
		expect(utilities.symbolIsValid('')).toBe(false)
		expect(utilities.symbolIsValid(void 0)).toBe(false)
		expect(utilities.symbolIsValid(null)).toBe(false)
	})
})

describe('getSymbolErrorMessage', () => {
	test('returns "must supply symbol" if passed null or undefined', () => {
		const error = 'must supply symbol'
		expect(utilities.getSymbolErrorMessage(void 0)).toBe(error)
		expect(utilities.getSymbolErrorMessage(null)).toBe(error)
	})

	test('returns "not a valid symbol" if currency doesn\'t exist', () => {
		const error = 'not a valid symbol'
		expect(utilities.getSymbolErrorMessage('')).toBe(error)
		expect(utilities.getSymbolErrorMessage(9876)).toBe(error)
	})
})
