import React from "react";

// Create a new Context object
// This will be used to share data across components without passing props manually at every level
const AppContext = React.createContext();

// Export the AppContext for use in other components
export default AppContext;