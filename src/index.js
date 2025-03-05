export default {
	async fetch(request, env) {
	  const accountId = env.ACCOUNT_ID;
	  const apiKey = env.API_KEY;
	  const userEmail = env.USER_EMAIL;
	  const daysInactiveThreshold = 5;
	  const batchSize = 50; // Adjust based on API limits or testing
  
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
  
	  // Step 4: Batch delete inactive users
	  let deletedUsersCount = 0;
	  const seatsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/seats`;
  
	  // Process inactive users in batches
	  for (let i = 0; i < inactiveUsers.length; i += batchSize) {
		const batch = inactiveUsers.slice(i, i + batchSize).map(user => ({
		  "access_seat": false,
		  "gateway_seat": false,
		  "seat_uid": user.seat_uid
		}));
  
		const patchResponse = await fetch(seatsUrl, {
		  method: "PATCH",
		  headers: headers,
		  body: JSON.stringify(batch)
		});
  
		const patchResult = await patchResponse.json();
  
		if (patchResult.success) {
		  deletedUsersCount += batch.length;
		} else {
		  console.log(`Failed to delete batch starting at index ${i}:`, patchResult.errors);
		  // Optionally, count only successful deletions if API provides per-item results
		}
	  }
  
	  // Step 5: Return response with counts only
	  const responseBody = {
		message: "Inactive users processed",
		TotalUsersFound: totalUsers,
		FivePlusDaysInactiveUsersFound: inactiveUsers.length,
		InactiveUsersDeleted: deletedUsersCount
	  };
  
	  return new Response(JSON.stringify(responseBody), {
		headers: { "Content-Type": "application/json" },
		status: 200
	  });
	},
  };