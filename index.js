
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
let borrowsCollection;

// ==================== MongoDB Connection ====================

async function connectToMongoDB() {
  try {
    await client.connect();

    console.log("You successfully connected to MongoDB!");

    const db = client.db("booknook");

    booksCollection = db.collection("books");
    borrowsCollection = db.collection("borrows");

    await borrowsCollection.createIndex(
      { bookId: 1, userId: 1 },
      {
        unique: true,
        partialFilterExpression: { active: true },
      }
    );
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
}

// ==================== GET ALL BOOKS ====================

app.get("/books", async (req, res) => {
  try {
    const books = await booksCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: books,
    });
  } catch (error) {
    console.error("Get Books Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch books",
    });
  }
});

// ==================== GET LATEST 6 BOOKS ====================

app.get("/books/latest", async (req, res) => {
  try {
    const books = await booksCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.status(200).json({
      success: true,
      data: books,
    });
  } catch (error) {
    console.error("Latest Books Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch latest books",
    });
  }
});

// ==================== GET SINGLE BOOK ====================

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
    console.error("Get Book Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch book",
    });
  }
});

// ==================== ADD BOOK ====================

app.post("/books", verifyToken, async (req, res) => {
  try {
    const bookData = req.body;
    const totalCopies = Number(bookData.totalCopies);

    if (
      !bookData.title ||
      !bookData.author ||
      !bookData.category ||
      !bookData.image ||
      !Number.isInteger(totalCopies) ||
      totalCopies < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid book information",
      });
    }

    const newBook = {
      title: bookData.title,
      author: bookData.author,
      category: bookData.category,
      image: bookData.image,
      description: bookData.description || "",
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
    console.error("Add Book Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add book",
    });
  }
});

// ==================== UPDATE BOOK ====================

app.patch("/books/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const totalCopies = Number(req.body.totalCopies);

    if (!Number.isInteger(totalCopies) || totalCopies < 1) {
      return res.status(400).json({
        success: false,
        message: "Total copies must be at least 1",
      });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(id),
      userId: req.user.sub,
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found or you are not the owner",
      });
    }

    const borrowedCopies =
      book.totalCopies - book.availableCopies;

    if (totalCopies < borrowedCopies) {
      return res.status(400).json({
        success: false,
        message: "Total copies cannot be less than borrowed copies",
      });
    }

    const updatedBook = {
      title: req.body.title,
      author: req.body.author,
      category: req.body.category,
      image: req.body.image,
      description: req.body.description || "",
      totalCopies,
      availableCopies: totalCopies - borrowedCopies,
      updatedAt: new Date(),
    };

    await booksCollection.updateOne(
      {
        _id: new ObjectId(id),
        userId: req.user.sub,
      },
      { $set: updatedBook }
    );

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

// ==================== DELETE BOOK ====================

app.delete("/books/:id", verifyToken, async (req, res) => {
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
      userId: req.user.sub,
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found or you are not the owner",
      });
    }

    if (book.availableCopies !== book.totalCopies) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a book while copies are borrowed",
      });
    }

    await booksCollection.deleteOne({
      _id: new ObjectId(id),
      userId: req.user.sub,
    });

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

// ==================== BORROW BOOK ====================

app.post("/borrows", verifyToken, async (req, res) => {
  let reservedBookId = null;

  try {
    const { bookId, borrowDate, returnDate } = req.body;
    const userId = req.user.sub;

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const borrowDateValue = new Date(borrowDate);
    const returnDateValue = new Date(returnDate);

    if (
      !borrowDate ||
      !returnDate ||
      Number.isNaN(borrowDateValue.getTime()) ||
      Number.isNaN(returnDateValue.getTime()) ||
      returnDateValue <= borrowDateValue
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid borrow and return dates",
      });
    }

    const bookObjectId = new ObjectId(bookId);

    const existingBorrow = await borrowsCollection.findOne({
      bookId: bookObjectId,
      userId,
      active: true,
    });

    if (existingBorrow) {
      return res.status(409).json({
        success: false,
        message: "You have already borrowed this book",
      });
    }

    const stockResult = await booksCollection.updateOne(
      {
        _id: bookObjectId,
        availableCopies: { $gt: 0 },
      },
      {
        $inc: { availableCopies: -1 },
      }
    );

    if (stockResult.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "This book is not available",
      });
    }

    reservedBookId = bookObjectId;

    const book = await booksCollection.findOne({
      _id: bookObjectId,
    });

    const borrowData = {
      bookId: bookObjectId,
      bookTitle: book.title,
      bookImage: book.image,
      userId,
      userName: req.user.name,
      userEmail: req.user.email,
      borrowDate: borrowDateValue,
      returnDate: returnDateValue,
      active: true,
      createdAt: new Date(),
    };

    const result = await borrowsCollection.insertOne(borrowData);

    reservedBookId = null;

    res.status(201).json({
      success: true,
      message: "Book borrowed successfully!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    if (reservedBookId) {
      await booksCollection.updateOne(
        { _id: reservedBookId },
        { $inc: { availableCopies: 1 } }
      );
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already borrowed this book",
      });
    }

    console.error("Borrow Book Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to borrow book",
    });
  }
});

// ==================== GET MY BORROWS ====================

app.get("/borrows", verifyToken, async (req, res) => {
  try {
    const borrows = await borrowsCollection
      .find({
        userId: req.user.sub,
        active: true,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: borrows,
    });
  } catch (error) {
    console.error("Get Borrows Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch borrowed books",
    });
  }
});

// ==================== RETURN BOOK ====================

app.delete("/borrows/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid borrow ID",
      });
    }

    const borrow = await borrowsCollection.findOneAndDelete({
      _id: new ObjectId(id),
      userId: req.user.sub,
      active: true,
    });

    if (!borrow) {
      return res.status(404).json({
        success: false,
        message: "Borrow record not found",
      });
    }

    const stockResult = await booksCollection.updateOne(
      { _id: borrow.bookId },
      { $inc: { availableCopies: 1 } }
    );

    if (stockResult.matchedCount === 0) {
      await borrowsCollection.insertOne(borrow);

      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Book returned successfully!",
    });
  } catch (error) {
    console.error("Return Book Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to return book",
    });
  }
});

// ==================== ROOT ====================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "BookNook Server is Running!",
  });
});

// ==================== START SERVER ====================

connectToMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`);
  });
});
