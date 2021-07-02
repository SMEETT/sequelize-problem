// The goal is that Users can add other Users as "Contacts" (and that added Users have to "accept" before the connection is established)

// ***************************************************************
// SETUP (nothing special here)
// ***************************************************************
const express = require("express");

const { Sequelize, DataTypes } = require("sequelize");
const Op = Sequelize.Op;

const db = new Sequelize({
	dialect: "sqlite",
	storage: "./database.sqlite",
	logging: false,
	// retry: {
	// 	match: [/SQLITE_BUSY/],
	// 	name: "query",
	// 	max: 5,
	// },
	// transactionType: "IMMEDIATE",
});

const app = express();

// ***************************************************************
// SEQUELIZE MODELS
// ***************************************************************

const User = db.define("user", {
	name: {
		type: DataTypes.STRING,
	},
});

const Dog = db.define("dog", {
	name: {
		type: DataTypes.STRING,
	},
});

const Appointment = db.define("appointment", {
	start: {
		type: DataTypes.STRING,
	},
	end: {
		type: DataTypes.STRING,
	},
});

// ***************************************************************
// RELATIONS
// ***************************************************************

User.belongsToMany(User, { as: { singular: "Contact", plural: "Contacts" }, foreignKey: "userId", through: "connections" });
User.belongsToMany(User, { as: { singular: "User", plural: "Users" }, foreignKey: "contactId", through: "connections" });

Dog.belongsToMany(Appointment, { as: { singular: "Appointment", plural: "Appointments" }, through: "dogs_appointments" });
Appointment.belongsToMany(Dog, { as: { singular: "Dog", plural: "Dogs" }, through: "dogs_appointments" });

User.hasMany(Appointment);
Appointment.belongsTo(User);

Appointment.belongsToMany(User, {
	as: { singular: "Caretaker", plural: "Caretakers" },
	through: "caretakers_appointments",
	// alloswNull: true,
});

User.belongsToMany(Appointment, {
	as: { singular: "Caredate", plural: "Caredates" },
	through: "caretakers_appointments",
});

User.hasMany(Dog);
Dog.belongsTo(User);

// ***************************************************************
// DUMMY DATA (adds some users to the DB)
// ***************************************************************

async function initTransaction() {}

initTransaction();

let present = null;

async function checkForPresentData() {
	await User.findOne({ where: { id: 1 } }).then((user) => {
		if (user) {
			console.log("found a user");
			present = true;
		} else {
			console.log("no users yet");
			present = false;
		}
	});
}

async function addFakeData() {
	await checkForPresentData();
	console.log("here");
	console.log("present data return value", present);
	if (true) {
		console.log("adding fake data...");

		// ********************************************
		// USERS
		// ********************************************

		async function addUsers() {
			const usernames = ["Bob", "Ben", "Alfred", "Theo", "Fizzz", "Buzz"];
			function newUser(name) {
				const newUser = User.build({
					name: name,
				});
				newUser
					.save()
					.then((user) => {
						// console.log(user);
						return user;
					})
					.catch((err) => {
						console.log("Registering User Failed: ", err);
					});
			}
			usernames.forEach((name) => {
				newUser(name);
			});
		}
		await addUsers();

		async function addDogs() {
			const user = await User.findOne({ where: { id: 1 } });

			const newDog = await Dog.create({
				name: "Killer",
			});

			await user.addDog(newDog);
			// await newDog.setUser(user);

			const foundDogInDB = await Dog.findOne({ where: { id: 1 } });
			const dogsOwner = await foundDogInDB.getUser();

			console.log("doggos owner________________", dogsOwner);

			// console.log("FOUND DOG_________________", foundDogInDB.user);

			const ownedDogs = await user.getDogs();

			// console.log("owned doggos________________", ownedDogs);
		}

		await addDogs();

		async function addAppointment() {
			const newAppointment = Appointment.build({
				start: "some date",
				end: "another date",
			});

			const t = await db.transaction();

			try {
				await newAppointment.save({ transaction: t });
				const appointmentCreator = await User.findOne({ where: { id: 1 }, include: { model: Dog }, transaction: t });
				const caretaker = await User.findOne({ where: { id: 3 }, transaction: t });
				await newAppointment.setUser(appointmentCreator, { transaction: t });
				await newAppointment.addDogs(appointmentCreator.dogs, { transaction: t });
				await newAppointment.addCaretaker(caretaker, { transaction: t });
				await t.commit();
				console.log("Transaction successful");
			} catch (err) {
				console.log("Transaction failed", err);
				await t.rollback();
			}
		}
		await addAppointment();

		async function addDogsToAppointments() {}

		async function addUsersToAppointments() {}
	}
}

// ***************************************************************
// ADD USERS AS CONTACTS
// ***************************************************************
async function addUsersAsContacts() {
	await addFakeData();
	// get instances of Users with ID's 1-4
	const user1 = await User.findOne({ where: { id: 1 } });
	const user2 = await User.findOne({ where: { id: 2 } });
	const user3 = await User.findOne({ where: { id: 3 } });
	const user4 = await User.findOne({ where: { id: 4 } });
	const user5 = await User.findOne({ where: { id: 5 } });
	// const user25 = await User.findOne({ where: { id: 25 } });
	// const user115 = await User.findOne({ where: { id: 115 } });

	// user25.addUser(user115);
	// user115.addUser(user1);
	// user115.addUser(user2);

	// user1.addUser(user115);
	// user1.addUser(user25);

	// user2.addUser(user115);

	await user1.addContact(user5);

	// User 1 adds User 2 as a Contact
	await user1.addContact(user2);
	await user2.addContact(user1);

	await user3.addContact(user1);
	await user1.addContact(user3);

	await user4.addContact(user1);
	await user1.addContact(user4);
}

// ***************************************************************
// TRY TO FIND ACCEPTED CONTACTS (QUERY)
// ***************************************************************

async function findAcceptedContacts() {
	await addUsersAsContacts();

	// user whose contacts we want to find
	const user1 = await User.findOne({ where: { id: 1 } });

	// get all records (both sides) of our user in the "Contacs" table
	const users = await user1.getUsers({});
	const contacts = await user1.getContacts({});

	// put all found connections into a single array
	const combinedArray = [...contacts, ...users];
	// filter out the id's
	const combinedIds = combinedArray.map((el) => el.id);
	// filter out all Id's that are not duplicates (we want duplicates!)
	const filteredIds = combinedIds.filter((el, index) => {
		return combinedIds.indexOf(el) !== index;
	});

	// final array of established contacts
	const actualContacts = [];

	// use filtered Id's to get the User instances && make sure each user only gets added once
	combinedArray.forEach((user) => {
		if (filteredIds.includes(user.id) && !actualContacts.find((el) => el.id === user.id)) {
			actualContacts.push(user);
		}
	});

	// console.log("ACTUAL CONTACTS:__________________", actualContacts);
	return actualContacts;
}

findAcceptedContacts();

// ***************************************************************
// SYNC DB
// ***************************************************************
async function syncDB() {
	console.log("Syncing Database...");
	await db.sync();
	// await db.sync({ force: true });
}
syncDB();

// ***************************************************************
// LISTEN ON PORT 5001
// ***************************************************************
app.listen(5003, () => {
	console.log("App running on port 5003");
});
