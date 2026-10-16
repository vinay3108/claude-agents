const query = `
query recentSubmissionList($username: String!) {
  recentSubmissionList(username: $username) {
    title
    titleSlug
    timestamp
    statusDisplay
    lang
  }
}
`;

const response = await fetch("https://leetcode.com/graphql", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query,
    variables: {
      username: "vinaykr3108",
    },
  }),
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));