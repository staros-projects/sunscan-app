import * as React from "react"
import { Text, View, useWindowDimensions } from "react-native";
import { VictoryAxis, VictoryChart, VictoryLine, VictoryTheme, VictoryZoomContainer } from "victory-native";

// Component to display a spectrum chart
function Spectrum({data, title, subtitle, fwhm=''}) {  
  // Get the current window dimensions
  const {height, width} = useWindowDimensions();

  return (
  <View className="flex flex-col justify-center items-center">
      {/* Title and subtitle section */}
      <View className="flex flex-col justify-center items-center">
        <Text className="text-white font-bold text-xl">{title}</Text>
        <Text className=" mb-4 text-zinc-500" style={{fontSize:13}}>{subtitle}</Text>
      </View>

      <Text className="absolute z-50 top-0 text-white text-center mt-2" style={{ fontSize: 20, right:50 }}>FWHM : {fwhm?fwhm:'-'}</Text>
      
      {/* Victory Chart component */}
      <VictoryChart 
        theme={VictoryTheme.material}
        height={height/1.3} width={width} 
        padding={{ top: 5, left:90, right:100, bottom: 30 }}
      >
        {/* Y-axis configuration */}
        <VictoryAxis dependentAxis style={{
          axis: {
            stroke: 'transparent'  // Hide Y-axis line
          },
          tickLabels: {
            fill: 'white' // Set Y-axis label color to white
          }, 
          grid: {
            stroke: 'gray', // Set Y-axis grid lines color to gray
            strokeDasharray: '10', // Make grid lines dashed
          }
        }} />
        
        {/* Line chart */}
        <VictoryLine
          style={{
            data: { stroke: "#fff" }, // Set line color to white
            parent: { border: "1px solid #ccc"}
          }}
          data={data}
        />
      </VictoryChart> 
    </View>
  )
}

export default Spectrum


