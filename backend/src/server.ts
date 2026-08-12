import express from "express";

   const app = express();
   const PORT = 5000;

   // A simple test route — confirms the server is alive and responding
   app.get("/", (req, res) => {
     res.send("Potluck backend is running.");
   });

   app.listen(PORT, () => {
     console.log(`Server running at http://localhost:${PORT}`);
   });