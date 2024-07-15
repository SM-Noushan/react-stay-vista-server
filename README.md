# StayVista: Hotel Booking Platform

## Overview

This repository contains the server-side code for the StayVista application.

- [Live-Site](https://stayvista-by-sm-nowshan.vercel.app)
- [Client-Repo](https://github.com/sm-noushan/react-stay-vista-client)

## Setup

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/) (LTS version recommended)

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/SM-Noushan/react-stay-vista-server
   cd react-stay-vista-server
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Environment Setup**: Rename `.env.rename` to `.env` in the root directory of the project and add the necessary environment variables as well as change `MongoDB uri in index.js` with your specific configuration.. (**Important!**)

4. **Running the Server**: If you don't have nodemon installed globally, you can use npx:

   ```bash
    npx nodemon index.js
    Installing Nodemon Globally
   ```

   **Or**
   If you prefer to install nodemon globally, use the following command:

   ```bash
    npm install -g nodemon
   ```

   **Then**, to run the server locally, use the following command:

   ```bash
   nodemon index.js
   ```

This will start the server and make your API accessible at [http://localhost:8000](http://localhost:8000) (or your specified port).

## Frontend Setup

For detailed information, refer to the [Run the Project Locally](https://github.com/SM-Noushan/react-stay-vista-client) in the front-end repository's `README.md`. (**Important!**)

<br/>
<details>
    <summary>Thank you!</summary>
</details>
