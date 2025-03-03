export default {
	async fetch(request, env) {
	  const accountId = env.ACCOUNT_ID; // Needed for authentication
	  const apiKey= env.API_KEY; // Needed for authentication
	  const userEmail = env.USER_EMAIL; // Needed for authentication
	  const daysInactiveThreshold = 5; // Days before deleting inactive users
  
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
  
	  const inactiveUsers = [];
	  const now = new Date();
  
	  for (const user of usersData.result) {
		const lastSeen = user.last_seen_at ? new Date(user.last_seen_at) : null;
  
		if (lastSeen) {
		  const daysInactive = (now - lastSeen) / (1000 * 60 * 60 * 24);
		  if (daysInactive >= daysInactiveThreshold) {
			inactiveUsers.push({ id: user.id, email: user.user.email });
		  }
		}
	  }

	// Step 3: Return the list of inactive users
		const responseBody = {
			message: "Inactive users (inactive for 5+ days):",
			users: inactiveUsers,
		  };
  
	// Step 3: Delete inactive users
	  let deletedUsers = [];
	  for (const user of inactiveUsers) {
		const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/members/${user.id}`;
		const deleteResponse = await fetch(deleteUrl, { method: "DELETE", headers });
		const deleteResult = await deleteResponse.json();
  
		if (deleteResult.success) {
		  deletedUsers.push(user.email);
		} else {
		  console.log(`Failed to delete ${user.email}:`, deleteResult.errors);
		}
	  }
  
	  return new Response(`Deleted ${deletedUsers.length} inactive users: ${deletedUsers.join(", ")}`);
	},
  };
  