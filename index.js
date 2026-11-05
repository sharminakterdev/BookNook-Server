
import express from "express";
import "dotenv/config";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import verifyToken from "./middlewares/verifyToken.js";

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


// Add New Book - Protected Route
app.post("/books", verifyToken, async (req, res) => {
  try {
    console.log("Secure Add Book API Called!");

    const bookData = req.body;
    const totalCopies = Number(bookData.totalCopies);

    if (!Number.isInteger(totalCopies) || totalCopies < 1) {
      return res.status(400).json({
        success: false,
        message: "Total copies must be at least 1",
      });
    }

    const newBook = {
      title: bookData.title,
      author: bookData.author,
      category: bookData.category,
      image: bookData.image,
      description: bookData.description,

      // Verified user information from JWT
      userId: req.user.sub,
      userName: req.user.name,
      userEmail: req.user.email,

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
    console.error("Secure Add Book Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add book",
    });
  }
});
// Get All Books
app.get("/books", async (req, res) => {
  try {
    const allBooks = await booksCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: allBooks,
    });

  } catch (error) {
    console.error("All Books Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch books",
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
// Get Single Book Details
app.get("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      data: book,
    });

  } catch (error) {
    console.error("Book Details Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch book details",
    });
  }
});
// PATCH /books/:id - Update a book
app.patch("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const {
      title,
      author,
      category,
      image,
      description,
      totalCopies,
    } = req.body;

    const updatedBook = {
      title,
      author,
      category,
      image,
      description,
      totalCopies: Number(totalCopies),
    };

    if (
      !Number.isInteger(updatedBook.totalCopies) ||
      updatedBook.totalCopies < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Total copies must be at least 1",
      });
    }

    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedBook }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Book updated successfully!",
    });
  } catch (error) {
    console.error("Update Book Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update book",
    });
  }
});

// DELETE /books/:id - Delete a book
app.delete("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const result = await booksCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Book deleted successfully!",
    });
  } catch (error) {
    console.error("Delete Book Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete book",
    });
  }
});
app.get("/", (req, res) => {
  res.send({ message: "Server is running fine" });
});
app.get("/protected", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "JWT verified successfully!",
    user: req.user,
  });
});
connectToMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`);
  });
});