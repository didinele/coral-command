async function* createAsyncGenerator() {
	for (let i = 0; i < 3; i++) {
		yield i;
	}

	throw new Error('Error in generator');
}

const gen = createAsyncGenerator();
while (true) {
	try {
		const { value, done } = await gen.next();
		console.log(value, done);
	} catch (error) {
		console.error(error.message);
		break;
	}
}

console.log('--------');

function* genOne() {
	yield 3;
	return { some: 'state' };
}

function* genTwo() {
	const state = yield* genOne();
	console.log(state);
}

const x = genTwo();
while (true) {
	const { value, done } = x.next();
	console.log(done, value);
	if (done) {
		break;
	}
}
