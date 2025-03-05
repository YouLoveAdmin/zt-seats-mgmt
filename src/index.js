export default {
	async fetch(request, env) {
	  const accountId = env.ACCOUNT_ID;
	  const apiKey = env.API_KEY;
	  const userEmail = env.USER_EMAIL;
	  const daysInactiveThreshold = 5;
  
	  const headers = {
		"X-Auth-Email": userEmail,
		"X-Auth-Key": apiKey,
		"Content-Type": "application/json",
	  };
  
	  // Step 1: Get all users
	  const usersUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/users`;
	  const usersResponse = await fetch(usersUrl, { headers });
	  const usersData = await usersResponse.json();
  
	  if (!usersData.success) {
		return new Response(`Error fetching users: ${JSON.stringify(usersData.errors)}`, { status: 500 });
	  }
  
	  // Step 2: Count total users
	  const totalUsers = usersData.result.length;
  
	  // Step 3: Identify inactive users
	  const inactiveUsers = [];
	  const now = new Date();
  
	  for (const user of usersData.result) {
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
  
	  // Step 4: Delete inactive users using PATCH method
	  let deletedUsersCount = 0;
	  const seatsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/seats`;
  
	  for (const user of inactiveUsers) {
		const patchBody = [{
		  "access_seat": false,
		  "gateway_seat": false,
		  "seat_uid": user.seat_uid
		}];
  
		const patchResponse = await fetch(seatsUrl, {
		  method: "PATCH",
		  headers: headers,
		  body: JSON.stringify(patchBody)
		});
  
		const patchResult = await patchResponse.json();
  
		if (patchResult.success) {
		  deletedUsersCount++;
		} else {
		  console.log(`Failed to delete ${user.email}:`, patchResult.errors);
		}
	  }
  
	  // Step 5: Return response with counts only
	  const responseBody = {
		message: "Inactive users processed",
		TotalUsersFound: totalUsers,
		InactiveUsersForMoreThanFiveDays: inactiveUsers.length,
		UsersDeleted: deletedUsersCount
	  };
  
	  return new Response(JSON.stringify(responseBody), {
		headers: { "Content-Type": "application/json" },
		status: 200
	  });
	},
  };