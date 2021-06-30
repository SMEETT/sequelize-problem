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

// const PendingContacts = db.define("pending_contacts", {});
// CONTACTS Model (Through Table)
// The model for the through-table, with an additional column "accepted"
// due to how Sequelize works two other columns are added automatically "UserId" and "adderId" (see "REALTIONS" below)
const Connections = db.define("Connections", { accepted: { type: DataTypes.BOOLEAN, defaultValue: false } });

// ***************************************************************
// RELATIONS
// ***************************************************************
// M-to-M relation between Users, using the "Contacts" through-table (defined above)

as: User.belongsToMany(User, { as: { singular: "User", plural: "Users" }, foreignKey: "userId", through: Connections });
User.belongsToMany(User, { as: { singular: "Contact", plural: "Contacts" }, foreignKey: "contactId", through: Connections });

// ***************************************************************
// DUMMY DATA (adds some users to the DB)
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
	// get instances of Users with ID's 1-4
	const user1 = await User.findOne({ where: { id: 1 } });
	const user2 = await User.findOne({ where: { id: 2 } });
	const user3 = await User.findOne({ where: { id: 3 } });
	const user4 = await User.findOne({ where: { id: 4 } });
	const user5 = await User.findOne({ where: { id: 5 } });
	const user25 = await User.findOne({ where: { id: 25 } });
	const user115 = await User.findOne({ where: { id: 115 } });

	user25.addUser(user115);
	user115.addUser(user1);
	user115.addUser(user2);

	user1.addUser(user115);
	user1.addUser(user25);

	user2.addUser(user115);

	await user1.addUser(user5);

	// User 1 adds User 2 as a Contact
	await user1.addUser(user2);
	await user2.addUser(user1);

	await user3.addUser(user1);
	await user1.addUser(user3);

	await user4.addUser(user1);
	await user1.addUser(user4);

	// at this point the through-table "Contacts" looks like this
	// please note that user.addUser(user) means that the instance calling the method
	// is represented by the "adderId"

	// adderId  | UserId   | accepted
	//---------------------------------
	// 1        | 2         | 0
	// 1        | 3         | 0
	// 4        | 1         | 0

	// Here things already seem weird to me. I would like to be able to query for the USER through the CONTACTS table
	// instead of querying the CONTACTS through-table

	// User 1 accepts the Contact-Request of User 4
	// const user1InThroughTable = await Contacts.findOne({ where: { UserId: 1, adderId: 4 } });
	// user1InThroughTable.accepted = 1;
	// await user1InThroughTable.save();

	// now the updated "Contacts" through-table looks like this:

	// adderId  | UserId   | accepted
	//---------------------------------
	// 1        | 2         | 1
	// 1        | 3         | 0
	// 4        | 1         | 1
}

// ***************************************************************
// TRY TO FIND ACCEPTED CONTACTS (QUERY)
// ***************************************************************

async function findAcceptedContacts() {
	await addUsersAsContacts();

	// user whose contacts we want to find
	const user1 = await User.findOne({ where: { id: 115 } });

	// get all records (both sides) of our user in the "Contacs" table
	const contacts = await user1.getContacts({});
	const users = await user1.getUsers({});

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

	console.log(actualContacts);
	return actualContacts;
}

// Same problem: seems weird to query the through table since it only gives back Id's while I would prefer to get User instances
// In theory this works but seems not ideal
// So my question is: how do I query for Users THROUGH the Contacts table?
// find all Contacts for User with Id 1 (doesn't matter if the User is the one who added or was added since we look for both)
// ***************************************************************
// CURRENT, UGLY WORKAROUND
// ***************************************************************
// the id of the User whoms accepted contacts we try to find
// const id = 1;
// find all Contacts where the requested id is either === the UserId or === the adderId and where "accepted" === 1
// const acceptedContactsOfUserWithId1 = await Contacts.findAll({ where: { [Op.or]: [{ UserId: id }, { adderId: id }], accepted: 1 } });
// go through the result of the above query and get the Id's that are NOT the current User's
// If the User with id 1 (the one whoms contacts we want) is the adder we return the UserId, if our User is the User who was added
// we return the adderId
// const filtered = acceptedContactsOfUserWithId1.map(function (curr) {
// 	return curr.adderId === id ? curr.UserId : curr.adderId;
// });
// "filtered" is now an array of Id's
// console.log("FILTERED ID'S___________________________", filtered);
// now we just query User's for those ID's
// finalListOfContacts = await User.findAll({ where: { id: filtered } });
// console.log(`FINAL LIST OF CONTACTS FOR USER WITH ID ${id}: ------------------------ : `, finalListOfContacts);

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
