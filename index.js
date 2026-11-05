
import express from "express";
import "dotenv/config";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URL);

let booksCollection;

export async function connectToMongoDB() {
  try {
    await client.connect();

    console.log("You successfully connected to MongoDB!");

    const db = client.db("booknook");
    booksCollection = db.collection("books");

  } catch (err) {
    console.dir(err);
    process.exit(1);
  }
}

app.get("/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

app.post("/add-book", async (req, res) => {
  try {
    console.log("Add Book API Called!");

    const bookData = req.body;

    const totalCopies = Number(bookData.totalCopies || 5);

    const newBook = {
      ...bookData,
      totalCopies,
      availableCopies: totalCopies,
      createdAt: new Date(),
    };

    const result = await booksCollection.insertOne(newBook);

    res.status(201).json({
      success: true,
      message: "Book added successfully!",
      insertedId: result.insertedId,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to add book",
    });
  }
});
// Get Latest 6 Books
app.get("/books/latest", async (req, res) => {
  try {
    const latestBooks = await booksCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.status(200).json({
      success: true,
      data: latestBooks,
    });

  } catch (error) {
    console.error("Latest Books Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch latest books",
    });
  }
});

app.get("/", (req, res) => {
  res.send({ message: "Server is running fine" });
});

connectToMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`);
  });
});
