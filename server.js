// The goal is to be able to add other "Users" as a "Contact" and the added User has to "accept" before the connection between the two Users is established
// My problem is that I can't figure out how to properly query for "Established Contacts"

// ***************************************************************
// SETUP
// ***************************************************************
const express = require("express");

const { Sequelize, DataTypes } = require("sequelize");
const Op = Sequelize.Op;

const db = new Sequelize({
	dialect: "sqlite",
	storage: "./database.sqlite",
	logging: false,
});

const app = express();

// ***************************************************************
// SEQUELIZE MODELS
// ***************************************************************

// USER Model
// Very simple model with nothing but a name
const User = db.define("user", {
	name: {
		type: DataTypes.STRING,
	},
});
// CONTACTS Model (Through Table)
// The model for the through-table, with additional column "accepted"
const Contacts = db.define("Contacts", { accepted: { type: DataTypes.BOOLEAN, defaultValue: false } });

// ***************************************************************
// RELATIONS
// ***************************************************************
// M-to-M relation between Users, using the "Contacts" through-table
User.belongsToMany(User, { as: "User", foreignKey: "adderId", through: Contacts });

// ***************************************************************
// DUMMY DATA
// ***************************************************************
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

// ***************************************************************
// ADD USERS AS CONTACTS
// ***************************************************************
async function addUsersAsContacts() {
	// get instances of Users
	const user1 = await User.findOne({ where: { id: 1 } });
	const user2 = await User.findOne({ where: { id: 2 } });
	const user3 = await User.findOne({ where: { id: 3 } });
	const user4 = await User.findOne({ where: { id: 4 } });

	// User 1 adds User 2 + 3 as a Contact
	await user1.addUser(user2);
	await user1.addUser(user3);
	// User 4 adds User 1 as a Contact
	await user4.addUser(user1);

	// User 2 accepts the Contact-Request of User 1
	// Here things already seem weird to me. I would like to be able to query for the USER through the CONTACTS table
	// instead of querying the CONTACTS through-table
	const user2InThroughTable = await Contacts.findOne({ where: { UserId: 2, adderId: 1 } });
	user2InThroughTable.accepted = true;
	await user2InThroughTable.save();
}
addUsersAsContacts();

// ***************************************************************
// TRY TO FIND ACCEPTED CONTACTS
// ***************************************************************
async function findAcceptedContacts() {
	// Same problem: seems weird to query the through table since it only gives back Id's while I would prefer to get User instances
	// In theory this works but seems not ideal
	// So my question is: how do I query for Users THROUGH the Contacts table?

	// find all Contacts for User with Id 1 (doesn't matter if the User is the one who added or was added since we look for both)
	const acceptedContactsOfUserWithId1 = await Contacts.findAll({ where: { [Op.or]: [{ UserId: 1 }, { adderId: 1 }], accepted: 1 } });
	console.log("acceptedContactsOfUserWithId1______________________________________________: ", acceptedContactsOfUserWithId1);
}
findAcceptedContacts();

// ***************************************************************
// SYNC DB
// ***************************************************************
async function syncDB() {
	console.log("Syncing Database...");
	await db.sync({});
	// await db.sync({ force: true });
}
syncDB();

// ***************************************************************
// LISTEN ON PORT 5001
// ***************************************************************
app.listen(5001, () => {
	console.log("App running on port 5001");
});
