require("dotenv").config();
const axios = require("axios");

axios.post(
  "http://localhost:3000/api/v1/integrations/auth/validate-credentials",
  {
    empno: "03-10518",
    password: "P@ssw0rd"
  },
  {
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `ApiKey ${process.env.HARMONY_API_TOKEN.trim()}`
    }
  }
)
.then(res => {
  console.log(res.data);
})
.catch(err => {
  console.log("REQUEST HEADERS");
  console.log(err.config.headers);

  console.log("STATUS");
  console.log(err.response?.status);

  console.log("BODY");
  console.log(err.response?.data);
});