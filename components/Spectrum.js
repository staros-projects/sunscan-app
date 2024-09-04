import * as React from "react"
import { Text, View, useWindowDimensions } from "react-native";
import { VictoryAxis,VictoryChart,  VictoryLine, VictoryTheme } from "victory-native";


function Spectrum({data, title, subtitle}) {

  const {height, width} = useWindowDimensions();

  return (
  <View className="flex flex-col justify-center items-center">
      <View className="flex flex-col justify-center items-center">
        <Text className="text-white font-bold text-xl">{title}</Text>
        <Text className=" mb-4 text-zinc-500" style={{fontSize:13}}>{subtitle}</Text>
        </View>
        <VictoryChart 
        theme={VictoryTheme.material}
        height={height/1.3} width={width} padding={{ top: 5, left:90, right:100, bottom: 30 }}
        >
             <VictoryAxis dependentAxis style={{
      axis: {
        stroke: 'transparent'  //CHANGE COLOR OF Y-AXIS
      },
      tickLabels: {
        fill: 'white' //CHANGE COLOR OF Y-AXIS LABELS
      }, 
      grid: {
        stroke: 'gray', //CHANGE COLOR OF Y-AXIS GRID LINES
        strokeDasharray: '10',
      }
    }} />
          <VictoryLine
          
            style={{
              data: { stroke: "#fff" },
              parent: { border: "1px solid #ccc"}
            }}
            data={data}
          
           
            
          />
        </VictoryChart> 
        </View>
  )
}

export default Spectrum


