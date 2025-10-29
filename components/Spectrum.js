import { useFont } from "@shopify/react-native-skia";
import { set } from "lodash";
import * as React from "react";
import { Text, View, useWindowDimensions, StyleSheet } from "react-native";
import { CartesianChart,  Line } from "victory-native";

import baumans from "../assets/fonts/Baumans-Regular.ttf";


function Spectrum({ rawData, title, subtitle, fwhm = '' }) {
  
  const { height, width } = useWindowDimensions();
  const [data, setData] = React.useState([]);
  const font = useFont(baumans, 12);
  React.useEffect(() => {
      if (!rawData) {
        return;
      }
      const data = rawData.map((y, index) => ({
          x: index,  
          y: parseInt(y)       
        }));
    setData(data);
  }, [rawData]);

  return (
    <View style={styles.container}>
      {/* Title and subtitle */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      { title !== 'Continuum' &&
      <Text style={[styles.fwhmText, { top:35, right: 70 }]}>
        FWHM : {fwhm ? fwhm : '-'}
      </Text>}

      {/* Victory Chart */}
      <View style={{ height:height/1.5, width:width-200 }} className="relative mr-10">
        <CartesianChart 
                data={data} 
                xKey="x" 
                yKeys={["y"]}
                axisOptions={{ font, labelColor: "white", lineColor: "white", tickColor: "white" }}
                frame={{lineColor: "white", lineWidth: 2}}
                >
            {({ points }) => (
              <Line
                points={points.y}
                color="white"
                strokeWidth={2}
              />
            )}
          </CartesianChart>
      </View>
     
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  titleContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 20
  },
  subtitle: {
    marginBottom: 16,
    color: '#a1a1aa', // équivalent text-zinc-500
    fontSize: 13
  },
  fwhmText: {
    position: 'absolute',
    zIndex: 50,
    top: 0,
    textAlign: 'center',
    color: 'white',
    fontSize: 20
  }
});

export default Spectrum;
