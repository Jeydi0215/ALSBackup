import { useState , useEffect} from 'react'

import styles from '../css/Monitoring.module.css'
import EmployeeTracker from './EmployeeTracker'
import Pending from './Pending'
import Logged from '../assets/logged.png'
import Search from '../assets/search.png'
import Clock from '../assets/clock.png'
import Coffee from '../assets/coffee.png'
import Out from '../assets/logout.png'
import { useMonitoring } from '../context/MonitoringContext';
import { db } from '../firebase'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';


const Monitoring = () => {
    const [activeButton, setActiveButton] = useState('tracker'); 
    const [TableShow, setTableShow] = useState(false)
    const handleTableClick = (buttonName) => {
        setTableShow( !TableShow )
        setActiveButton(buttonName);
    }
    const [statusCounts, setStatusCounts] = useState({
        working: 0,
        onBreak: 0,
        clockedOut: 0
    });


    const { loggedInCount, totalUsers } = useMonitoring();

    useEffect(() => {
        // Get today's date in the same format as your clockLog documents
        const today = new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric"
        });

        const q = query(
            collection(db, "clockLog"),
            where("date", "==", today),
            orderBy("time", "desc")
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const employeeStatuses = new Map(); // Track latest status per employee
            
            querySnapshot.forEach((doc) => {
                const log = doc.data();
                if (!employeeStatuses.has(log.uid)) {
                    employeeStatuses.set(log.uid, log.key);
                }
            });

            // Count statuses
            let working = 0;
            let onBreak = 0;
            let clockedOut = 0;

            employeeStatuses.forEach((status) => {
                switch(status) {
                    case 'clockIn':
                        working++;
                        break;
                    case 'breakOut':
                        onBreak++;
                        break;
                    case 'breakIn':
                        working++;
                        break;
                    case 'clockOut':
                        clockedOut++;
                        break;
                }
            });

            setStatusCounts({
                working,
                onBreak,
                clockedOut,
            });
        });

        return () => unsubscribe();
    }, []);

    return(
        <div className={styles.Monitoring}>
            <span className={styles.Monitoring_title}>Employee Monitoring</span>
            <div className={styles.Widget_container}>
                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Logged In</span>
                        <img src={Logged} alt="User icon" />
                    </div>
                    <span className={styles.Count}>{loggedInCount-1}/{totalUsers}</span>
                </div>

                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Working</span>
                        <img src={Clock} alt="User icon" />
                    </div>
                    <span className={styles.Count}>{statusCounts.working}/{totalUsers}</span>
                </div>

                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>On Break</span>
                        <img src={Coffee} alt="User icon" />
                    </div>
                    <span className={styles.Count}>{statusCounts.onBreak}/{totalUsers}</span>
                </div>

                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Clock Out</span>
                        <img src={Out} alt="User icon" />
                    </div>
                    <span className={styles.Count}>{statusCounts.clockedOut}/{totalUsers}</span>
                </div>
            </div>

            <div className={styles.Monitoring_table}>
                <div className={styles.Monitoring_inner}>
                    <div className={styles.Monitoring_left}>
                        <button
                            className={activeButton === 'tracker' ? styles.Active : ''}
                            onClick={() => handleTableClick('tracker')}
                        >
                            Tracker
                        </button>
                        <button
                            className={activeButton === 'approval' ? styles.Active : ''}
                            onClick={() => handleTableClick('approval')}
                        >
                            Approval
                        </button>
                    </div>

                    {/* <div className={styles.Monitoring_right}>
                        <div className={styles.Right_inner}>
                            <input type="text" placeholder='Search...'/>
                            <img src={Search} alt="Search icon" />
                        </div>
                        <select name="" id="">
                            <option value="">All</option>
                        </select>
                    </div> */}
                </div>
                {
                    TableShow ?<Pending /> : <EmployeeTracker/>
                }
                
                


            </div>
        </div>
    )
}


export default Monitoring;