// Shared function to fetch users
async function fetchUsers(env) {
	const headers = {
	  "X-Auth-Email": env.USER_EMAIL,
	  "X-Auth-Key": env.API_KEY,
	  "Content-Type": "application/json",
	};
	const usersUrl = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/access/users`;
	const response = await fetch(usersUrl, { headers });
	const data = await response.json();
  
	if (!data.success) {
	  throw new Error(`Error fetching users: ${JSON.stringify(data.errors)}`);
	}
	return data.result;
  }
  
  // Shared function to identify inactive users
  function getInactiveUsers(users, daysInactiveThreshold) {
	const now = new Date();
	const inactiveUsers = [];
  
	for (const user of users) {
	  const lastSeen = user.last_successful_login ? new Date(user.last_successful_login) : null;
	  if (lastSeen) {
		const daysInactive = (now - lastSeen) / (1000 * 60 * 60 * 24);
		if (daysInactive >= daysInactiveThreshold) {
		  inactiveUsers.push({
			email: user.email || "Unknown",
			seat_uid: user.seat_uid || "Not available"
		  });
		}
	  }
	}
	return inactiveUsers;
  }
  
  // Shared function to delete inactive users in batches
  async function deleteInactiveUsers(env, inactiveUsers, batchSize) {
	const headers = {
	  "X-Auth-Email": env.USER_EMAIL,
	  "X-Auth-Key": env.API_KEY,
	  "Content-Type": "application/json",
	};
	const seatsUrl = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/access/seats`;
	let deletedCount = 0;
  
	for (let i = 0; i < inactiveUsers.length; i += batchSize) {
	  const batch = inactiveUsers.slice(i, i + batchSize).map(user => ({
		"access_seat": false,
		"gateway_seat": false,
		"seat_uid": user.seat_uid
	  }));
  
	  const response = await fetch(seatsUrl, {
		method: "PATCH",
		headers,
		body: JSON.stringify(batch)
	  });
	  const result = await response.json();
  
	  if (result.success) {
		deletedCount += batch.length;
	  } else {
		console.log(`Failed to delete batch starting at index ${i}:`, result.errors);
	  }
	}
	return deletedCount;
  }
  
  export default {
	// Scheduled handler for Cron job
	async scheduled(event, env, ctx) {
	  try {
		const users = await fetchUsers(env);
		const inactiveUsers = getInactiveUsers(users, 5); // daysInactiveThreshold = 5
		await deleteInactiveUsers(env, inactiveUsers, 50); // batchSize = 50
		console.log("Inactive users processed successfully by scheduler");
	  } catch (error) {
		console.error(error.message);
	  }
	},
  
  // Fetch handler for manual triggering
  async fetch(request, env) {
	const url = new URL(request.url);
	const pathname = url.pathname;

	// Silently ignore requests to /favicon.ico
	if (pathname === "/favicon.ico") {
	  return new Response(null, { status: 204 });
	}

	try {
	  const users = await fetchUsers(env);
	  const email = url.searchParams.get("email");
	  let inactiveUsers;
	  let deletedUsersCount;
	  if (email) {
		// Find the user with the specified email
		const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
		if (!user) {
		  return new Response(JSON.stringify({ error: `User with email ${email} not found.` }), {
			headers: { "Content-Type": "application/json" },
			status: 404
		  });
		}
		inactiveUsers = [{ email: user.email, seat_uid: user.seat_uid }];
		deletedUsersCount = await deleteInactiveUsers(env, inactiveUsers, 1);
	  } else {
		inactiveUsers = getInactiveUsers(users, 5); // daysInactiveThreshold = 5
		deletedUsersCount = await deleteInactiveUsers(env, inactiveUsers, 50); // batchSize = 50
	  }

	  const responseBody = {
		message: email
		  ? `User with email ${email} processed for deletion`
		  : "Inactive users processed (Manual)",
		TotalUsersFound: users.length,
		FivePlusDaysInactiveUsersFound: email ? (inactiveUsers.length ? 1 : 0) : inactiveUsers.length,
		InactiveUsersDeleted: deletedUsersCount
	  };

	  return new Response(JSON.stringify(responseBody), {
		headers: { "Content-Type": "application/json" },
		status: 200
	  });
	} catch (error) {
	  return new Response(error.message, { status: 500 });
	}
  },
  };