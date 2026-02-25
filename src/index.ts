import "dotenv/config";
import express from "express";
import identifyRoute from "./routes/identify.route";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(identifyRoute);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
